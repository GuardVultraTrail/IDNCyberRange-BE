// ===========================================================================
// MIDDLEWARE: requireRole (RBAC dinamis)
// ---------------------------------------------------------------------------
// Lapis kedua pertahanan API: OTORISASI BERBASIS PERAN (Role-Based Access
// Control). Membatasi akses sebuah endpoint hanya untuk role tertentu.
//
// Disebut "dinamis" karena daftar role yang diizinkan diberikan sebagai
// argumen pada saat mendefinisikan route, mis:
//     router.get('/admin/users', verifyToken, requireRole('ADMIN'), handler)
//     router.post('/labs',       verifyToken, requireRole('ADMIN','PESERTA'), handler)
//
// Catatan keamanan (skripsi):
//   - requireRole HARUS dipasang SETELAH verifyToken, karena ia membaca
//     req.user.role yang sudah divalidasi dari DB.
//   - Pengecekan ini menangani otorisasi tingkat-FUNGSI (function-level):
//     "apakah role ini boleh memanggil aksi ini?". Ia BELUM menjawab
//     "apakah user ini boleh menyentuh OBJEK SPESIFIK ini?" — pertanyaan
//     terakhir itu dijawab oleh pengecekan kepemilikan anti-BOLA di controller
//     (lihat lab.controller.js). Keduanya saling melengkapi.
// ===========================================================================
const ApiError = require('../utils/ApiError');

function requireRole(...allowedRoles) {
  // Normalisasi ke huruf besar agar perbandingan konsisten.
  const allowed = allowedRoles.map((r) => String(r).toUpperCase());

  return function (req, res, next) {
    // Guard: pastikan verifyToken sudah berjalan lebih dulu.
    if (!req.user || !req.user.role) {
      return next(ApiError.unauthorized('Autentikasi diperlukan sebelum pengecekan role.'));
    }

    // Default-deny: tolak kecuali role pemanggil benar-benar ada di whitelist.
    // Pendekatan "tolak secara default" lebih aman daripada "izinkan kecuali".
    if (!allowed.includes(req.user.role.toUpperCase())) {
      return next(
        ApiError.forbidden(
          `Akses ditolak. Endpoint ini hanya untuk role: ${allowed.join(', ')}.`
        )
      );
    }

    next();
  };
}

module.exports = requireRole;
