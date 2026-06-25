// ===========================================================================
// ROUTES: /api/labs
// ---------------------------------------------------------------------------
// Catatan keamanan berlapis:
//   - verifyToken dipasang di SELURUH route lab -> tidak ada akses anonim.
//   - requireRole membatasi siapa yang boleh memanggil aksi (function-level).
//   - Pengecekan kepemilikan (object-level / anti-BOLA) dilakukan DI DALAM
//     controller, karena hanya di sanalah objek spesifik (lab :id) bisa
//     diperiksa terhadap pemiliknya. requireRole saja TIDAK cukup mencegah
//     BOLA — keduanya harus dipakai bersama.
// ===========================================================================
const express = require('express');
const {
  listLabs,
  getLab,
  createLab,
  updateLab,
  deleteLab,
  uploadLabLogo,
} = require('../controllers/lab.controller');
const {
  solveTask,
  submitFlag,
  addFavorite,
  removeFavorite,
} = require('../controllers/progress.controller');
const { createLabSchema, updateLabSchema } = require('../validators/lab.validator');
const validate = require('../middleware/validate');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const { uploadLogo } = require('../middleware/upload');

const router = express.Router();

// Semua endpoint lab membutuhkan autentikasi.
router.use(verifyToken);

// Baca: admin & peserta sama-sama boleh memanggil; filter/otorisasi objek
// ditentukan di controller.
router.get('/', requireRole('ADMIN', 'PESERTA'), listLabs);
router.get('/:id', requireRole('ADMIN', 'PESERTA'), getLab);

// Tulis: admin & peserta boleh membuat lab (peserta = submission). Kepemilikan
// di-set server.
router.post('/', requireRole('ADMIN', 'PESERTA'), validate(createLabSchema), createLab);

// Ubah & hapus: role-nya sama, TAPI kepemilikan objek dicek ketat di controller
// (peserta hanya boleh menyentuh lab miliknya; admin bebas).
router.put('/:id', requireRole('ADMIN', 'PESERTA'), validate(updateLabSchema), updateLab);
router.delete('/:id', requireRole('ADMIN', 'PESERTA'), deleteLab);

// Unggah logo machine (multipart). Kepemilikan objek dicek di controller.
router.post('/:id/logo', requireRole('ADMIN', 'PESERTA'), uploadLogo, uploadLabLogo);

// --- Progress & interaksi (gamifikasi) ---
// Pencatatan progress diikat ke req.user.id di controller (anti-IDOR).
router.post('/:id/tasks/:taskId/solve', requireRole('ADMIN', 'PESERTA'), solveTask);
router.post('/:id/flag', requireRole('ADMIN', 'PESERTA'), submitFlag);
router.post('/:id/favorite', requireRole('ADMIN', 'PESERTA'), addFavorite);
router.delete('/:id/favorite', requireRole('ADMIN', 'PESERTA'), removeFavorite);

module.exports = router;
