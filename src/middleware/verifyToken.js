// ===========================================================================
// MIDDLEWARE: verifyToken
// ---------------------------------------------------------------------------
// Lapis pertama pertahanan API: AUTENTIKASI.
// Tugasnya memastikan setiap request ke endpoint terproteksi membawa JWT yang
// sah, lalu menempelkan identitas user terverifikasi ke `req.user`.
//
// Mengapa penting untuk skripsi (Bab 3/4):
//   - Tanpa autentikasi yang benar, kontrol otorisasi (RBAC/BOLA) tidak ada
//     artinya — penyerang cukup mengaku sebagai siapa saja.
//   - Identitas pemanggil DIAMBIL DARI TOKEN yang ditandatangani server,
//     BUKAN dari body/query/header yang bisa dimanipulasi klien. Ini mencegah
//     "identity spoofing" yang menjadi pintu masuk privilege escalation.
// ===========================================================================
const { verifyJwt } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

const verifyToken = asyncHandler(async (req, res, next) => {
  // 1) Ambil token dari header Authorization berformat "Bearer <token>".
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    // Tidak ada token -> tolak. Jangan pernah meneruskan request anonim ke
    // handler yang mengasumsikan adanya `req.user`.
    throw ApiError.unauthorized('Header Authorization tidak ada atau salah format (gunakan: Bearer <token>).');
  }

  // 2) Verifikasi tanda tangan & masa berlaku token memakai JWT_SECRET server.
  //    Bila token dipalsukan/diubah/kedaluwarsa, verifyJwt melempar error yang
  //    ditangkap asyncHandler -> dikonversi menjadi 401 oleh errorHandler.
  const decoded = verifyJwt(token); // { sub, username, role, iat, exp }

  // 3) Ambil ulang user dari DATABASE berdasarkan id pada token.
  //    PENTING: kita tidak sepenuhnya percaya pada klaim di dalam token.
  //    Mengambil ulang dari DB memastikan:
  //      - user masih ada (belum dihapus),
  //      - role TERBARU dipakai (mis. admin baru saja menurunkan role-nya),
  //      - akun yang sudah diblokir (BANNED) langsung ditolak.
  //    Inilah pencegahan terhadap token "basi" yang menyimpan hak akses lama.
  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: {
      id: true,
      username: true,
      email: true,
      status: true,
      role: { select: { id: true, name: true } },
    },
  });

  if (!user) {
    throw ApiError.unauthorized('User pada token tidak ditemukan.');
  }
  if (user.status === 'BANNED') {
    throw ApiError.forbidden('Akun Anda telah diblokir.');
  }

  // 4) Tempelkan identitas terverifikasi ke req.user. Seluruh handler & cek
  //    otorisasi berikutnya WAJIB merujuk ke sini (sumber kebenaran identitas),
  //    bukan ke nilai apa pun yang dikirim klien.
  req.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role.name, // "ADMIN" / "PESERTA"
  };

  next();
});

module.exports = verifyToken;
