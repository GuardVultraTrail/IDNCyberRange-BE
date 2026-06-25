// ===========================================================================
// Skema validasi input Auth (Zod).
// ===========================================================================
const { z } = require('zod');

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter.')
    .max(30, 'Username maksimal 30 karakter.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username hanya boleh huruf, angka, dan underscore.'),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  password: z.string().min(6, 'Password minimal 6 karakter.').max(72, 'Password maksimal 72 karakter.'),
});

const loginSchema = z.object({
  // `identifier` boleh berupa username ATAU email (sesuai form login di mockup).
  identifier: z.string().trim().min(1, 'Username atau email wajib diisi.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});

module.exports = { registerSchema, loginSchema };
