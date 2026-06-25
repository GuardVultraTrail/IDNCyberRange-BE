// ===========================================================================
// ROUTES: /api/users  (administrasi pengguna — HANYA ADMIN)
// ---------------------------------------------------------------------------
// Contoh penerapan RBAC tingkat-fungsi: seluruh router dikunci untuk role
// ADMIN. Peserta yang mencoba memanggil endpoint ini — meski tokennya valid —
// akan ditolak dengan 403 oleh requireRole('ADMIN').
// ===========================================================================
const express = require('express');
const {
  listUsers,
  setUserRole,
  setUserStatus,
  deleteUser,
  getStats,
} = require('../controllers/user.controller');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// Autentikasi + otorisasi ADMIN untuk semua route di bawah ini.
router.use(verifyToken, requireRole('ADMIN'));

router.get('/stats', getStats);
router.get('/', listUsers);
router.patch('/:id/role', setUserRole);
router.patch('/:id/status', setUserStatus);
router.delete('/:id', deleteUser);

module.exports = router;
