// ===========================================================================
// ROUTES: /api/profile — pengelolaan akun SENDIRI (semua role terautentikasi).
// ---------------------------------------------------------------------------
// Tidak ada parameter :id di sini. Target operasi = pemilik token (req.user.id),
// sehingga endpoint ini secara desain bebas IDOR.
// ===========================================================================
const express = require('express');
const {
  updateProfile,
  changePassword,
  uploadAvatarHandler,
} = require('../controllers/profile.controller');
const { updateProfileSchema, changePasswordSchema } = require('../validators/profile.validator');
const validate = require('../middleware/validate');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const { uploadAvatar } = require('../middleware/upload');

const router = express.Router();

// Semua endpoint profil butuh autentikasi. Admin & peserta sama-sama boleh
// mengelola profilnya sendiri.
router.use(verifyToken, requireRole('ADMIN', 'PESERTA'));

router.patch('/', validate(updateProfileSchema), updateProfile);
router.patch('/password', validate(changePasswordSchema), changePassword);
// Upload avatar: multer (validasi tipe/ukuran) -> handler simpan path.
router.post('/avatar', uploadAvatar, uploadAvatarHandler);

module.exports = router;
