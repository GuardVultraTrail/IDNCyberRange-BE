// ===========================================================================
// Skema validasi input Lab (Zod).
// Perhatikan: `ownerId` SENGAJA tidak ada di skema. Pemilik lab ditentukan
// server dari token (req.user.id), bukan dari body — mencegah penyerang
// mengklaim/mengalihkan kepemilikan lewat input (mass assignment).
// ===========================================================================
const { z } = require('zod');

const taskSchema = z.object({
  question: z.string().trim().min(1, 'Pertanyaan tugas wajib diisi.'),
  answer: z.string().trim().min(1, 'Jawaban tugas wajib diisi.'),
  hint: z.string().trim().optional().nullable(),
  order: z.number().int().optional(),
});

const flagSchema = z.object({
  label: z.string().trim().min(1, 'Label flag wajib diisi.').max(60),
  value: z.string().trim().min(1, 'Nilai flag wajib diisi.').max(160),
  points: z.number().int().min(0).max(100000).optional(),
  order: z.number().int().optional(),
});

const createLabSchema = z.object({
  name: z.string().trim().min(1, 'Nama machine wajib diisi.').max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'INSANE']).default('EASY'),
  os: z.enum(['LINUX', 'WINDOWS']).default('LINUX'),
  ipAddress: z.string().trim().min(1, 'IP Address wajib diisi.').max(45),
  port: z.string().trim().max(60).optional().nullable(),
  // Flag fleksibel: minimal satu flag yang bisa di-submit.
  flags: z.array(flagSchema).min(1, 'Minimal satu flag wajib diisi.'),
  // Guided Mode opsional.
  guidedEnabled: z.boolean().optional().default(true),
  // Status menentukan visibilitas (published) secara otomatis di server:
  //   ACTIVE / RETIRED -> publik ; DRAFT -> privat. Field `published` TIDAK
  //   diterima dari klien, melainkan diturunkan dari status.
  status: z.enum(['ACTIVE', 'RETIRED', 'DRAFT']).default('DRAFT'),
  tasks: z.array(taskSchema).optional().default([]),
});

// Pada update semua field opsional (partial), tetap memblokir field liar.
const updateLabSchema = createLabSchema.partial();

module.exports = { createLabSchema, updateLabSchema };
