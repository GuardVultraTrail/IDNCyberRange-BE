// ===========================================================================
// Skema validasi input Profil (Zod).
// Field sensitif (role, status, level, email-unik, username) SENGAJA tidak ada
// di skema update profil -> user tidak bisa menaikkan role/level dirinya
// sendiri lewat endpoint self-service (anti privilege escalation).
// ===========================================================================
const { z } = require('zod');

const updateProfileSchema = z.object({
  displayName: z.string().trim().max(50, 'Display name maksimal 50 karakter.').optional().nullable(),
  bio: z.string().trim().max(300, 'Bio maksimal 300 karakter.').optional().nullable(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi.'),
  newPassword: z.string().min(6, 'Password baru minimal 6 karakter.').max(72, 'Password baru maksimal 72 karakter.'),
});

module.exports = { updateProfileSchema, changePasswordSchema };
