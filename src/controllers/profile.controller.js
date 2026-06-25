// ===========================================================================
// CONTROLLER: Profile (self-service) — user mengelola AKUNNYA SENDIRI.
// ---------------------------------------------------------------------------
// Catatan keamanan (relevan skripsi):
//   - Objek yang diubah SELALU ditentukan oleh req.user.id (dari token),
//     BUKAN dari id pada URL/body. Inilah pola yang membuat endpoint
//     "edit profil sendiri" kebal terhadap IDOR/BOLA: tidak ada cara bagi
//     user A mengubah profil user B.
//   - Bandingkan dengan user.controller.js (admin) yang menerima :id dari URL
//     namun dikunci requireRole('ADMIN').
//   - Ganti password: wajib verifikasi password lama (bcrypt.compare) sebelum
//     menyetel yang baru. Password baru disimpan sebagai hash.
// ===========================================================================
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { toPublicUser } = require('./auth.controller');
const { AVATAR_DIR } = require('../middleware/upload');

// PATCH /api/profile  { displayName?, bio? }
const updateProfile = asyncHandler(async (req, res) => {
  const { displayName, bio } = req.body;
  const user = await prisma.user.update({
    // Kunci: where berbasis id dari TOKEN, bukan dari input klien.
    where: { id: req.user.id },
    data: { displayName: displayName ?? null, bio: bio ?? null },
    include: { role: true },
  });
  res.json({ success: true, data: { user: toPublicUser(user) } });
});

// PATCH /api/profile/password  { currentPassword, newPassword }
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw ApiError.unauthorized();

  // Verifikasi password lama dulu (bcrypt.compare, konstan-waktu).
  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) throw ApiError.badRequest('Password saat ini salah.');

  const hashed = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });

  res.json({ success: true, data: { message: 'Password berhasil diperbarui.' } });
});

// POST /api/profile/avatar  (multipart: field "avatar")
// Middleware upload sudah memvalidasi tipe & ukuran; di sini kita simpan path.
const uploadAvatarHandler = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Tidak ada berkas gambar yang diunggah.');

  const relPath = `/uploads/avatars/${req.file.filename}`;

  // Hapus avatar lama (jika ada) agar tidak menumpuk di disk.
  const existing = await prisma.user.findUnique({ where: { id: req.user.id }, select: { avatarUrl: true } });
  if (existing?.avatarUrl) {
    const oldName = path.basename(existing.avatarUrl);
    const oldPath = path.join(AVATAR_DIR, oldName);
    // basename mencegah path traversal saat menghapus.
    fs.promises.unlink(oldPath).catch(() => {});
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { avatarUrl: relPath },
    include: { role: true },
  });

  res.json({ success: true, data: { user: toPublicUser(user) } });
});

module.exports = { updateProfile, changePassword, uploadAvatarHandler };
