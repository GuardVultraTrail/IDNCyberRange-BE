// ===========================================================================
// CONTROLLER: Auth (Register & Login)
// ===========================================================================
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { signToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Bentuk user aman yang dikirim ke klien — TIDAK pernah menyertakan password.
function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName ?? null,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    level: user.level,
    status: user.status,
    role: user.role?.name || user.role,
    createdAt: user.createdAt,
  };
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// Mendaftarkan peserta baru. Catatan keamanan penting:
//   - Role peserta DIPAKSA di sisi server menjadi "PESERTA". Klien TIDAK boleh
//     menentukan/menaikkan role-nya sendiri lewat body request. Mengabaikan
//     hal ini = celah privilege escalation klasik (mass assignment role).
//   - Password di-hash dengan bcrypt sebelum disimpan.
// ---------------------------------------------------------------------------
const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // Pastikan role PESERTA tersedia.
  const pesertaRole = await prisma.role.findUnique({ where: { name: 'PESERTA' } });
  if (!pesertaRole) {
    throw new ApiError(500, 'Role PESERTA belum tersedia. Jalankan seed terlebih dahulu.');
  }

  // Hash password (jangan simpan plaintext).
  const hashed = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashed,
      // roleId DITENTUKAN SERVER, bukan dari input klien -> anti privilege escalation.
      roleId: pesertaRole.id,
    },
    include: { role: true },
  });

  const token = signToken(user);
  res.status(201).json({
    success: true,
    data: { token, user: toPublicUser(user) },
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// Catatan keamanan:
//   - Memakai pesan error generik ("kredensial salah") baik saat username
//     tidak ada maupun password salah, untuk mencegah user enumeration
//     (penyerang menebak akun mana yang valid).
//   - Perbandingan password memakai bcrypt.compare (konstan-waktu), bukan ===.
// ---------------------------------------------------------------------------
const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  // Cari user berdasarkan username ATAU email.
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier.toLowerCase() }],
    },
    include: { role: true },
  });

  // Pesan generik (tidak membedakan "user tak ada" vs "password salah").
  const invalid = ApiError.unauthorized('Username/email atau password salah.');

  if (!user) throw invalid;

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw invalid;

  if (user.status === 'BANNED') {
    throw ApiError.forbidden('Akun Anda telah diblokir.');
  }

  const token = signToken(user);
  res.json({
    success: true,
    data: { token, user: toPublicUser(user) },
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me  (butuh verifyToken)
// Mengembalikan profil user yang sedang login berdasarkan token.
// ---------------------------------------------------------------------------
const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: true },
  });
  if (!user) throw ApiError.unauthorized();
  res.json({ success: true, data: { user: toPublicUser(user) } });
});

module.exports = { register, login, me, toPublicUser };
