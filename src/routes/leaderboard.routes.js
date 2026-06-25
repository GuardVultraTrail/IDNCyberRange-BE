// ===========================================================================
// ROUTES: /api/leaderboard — papan peringkat untuk semua user terautentikasi.
// ===========================================================================
const express = require('express');
const { getLeaderboard } = require('../controllers/user.controller');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.get('/', verifyToken, requireRole('ADMIN', 'PESERTA'), getLeaderboard);

module.exports = router;
