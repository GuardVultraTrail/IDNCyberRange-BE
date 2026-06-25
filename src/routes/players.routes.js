// ===========================================================================
// ROUTES: /api/players — profil PUBLIK pemain (semua user terautentikasi).
// Hanya membaca data non-sensitif user lain (untuk halaman lihat profil).
// ===========================================================================
const express = require('express');
const { getPublicProfile } = require('../controllers/user.controller');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.get('/:username', verifyToken, requireRole('ADMIN', 'PESERTA'), getPublicProfile);

module.exports = router;
