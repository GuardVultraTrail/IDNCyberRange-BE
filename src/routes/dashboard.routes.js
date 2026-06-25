// ===========================================================================
// ROUTES: /api/dashboard — agregasi metrik dashboard untuk user yang login.
// ===========================================================================
const express = require('express');
const { getDashboard } = require('../controllers/progress.controller');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.get('/', verifyToken, requireRole('ADMIN', 'PESERTA'), getDashboard);

module.exports = router;
