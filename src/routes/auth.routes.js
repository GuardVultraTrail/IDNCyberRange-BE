// ===========================================================================
// ROUTES: /api/auth
// ===========================================================================
const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, me } = require('../controllers/auth.controller');
const { registerSchema, loginSchema } = require('../validators/auth.validator');
const validate = require('../middleware/validate');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// Rate limiting khusus endpoint auth untuk mempersulit brute-force/credential
// stuffing pada login & spam pendaftaran.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 20, // maksimal 20 percobaan per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Terlalu banyak percobaan. Coba lagi nanti.' } },
});

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);

// /me terproteksi — wajib membawa token valid.
router.get('/me', verifyToken, me);

module.exports = router;
