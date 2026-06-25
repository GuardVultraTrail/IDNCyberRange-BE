// ===========================================================================
// MIDDLEWARE: upload (multer) — penanganan unggah gambar yang aman.
// Dipakai untuk foto profil (avatars) DAN logo machine (logos).
// ---------------------------------------------------------------------------
// Catatan keamanan (relevan skripsi — keamanan file upload):
//   - WHITELIST tipe konten: hanya image/png|jpeg|webp. Menolak tipe lain
//     mencegah unggahan berkas berbahaya (mis. .php/.html/.svg+script).
//   - BATAS UKURAN (2 MB) untuk mencegah pengurasan disk / DoS.
//   - NAMA FILE DIBUAT ACAK di server (crypto.randomBytes) + ekstensi dari
//     whitelist. Nama asli klien TIDAK dipakai -> cegah path traversal &
//     penimpaan berkas milik orang lain.
//   - Tiap jenis disimpan di subdirektori khusus di luar kode aplikasi.
// ===========================================================================
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

// Tipe yang diizinkan -> ekstensi aman.
const ALLOWED = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

function fileFilter(req, file, cb) {
  if (!ALLOWED[file.mimetype]) {
    return cb(ApiError.badRequest('Format gambar harus PNG, JPG, atau WEBP.'));
  }
  cb(null, true);
}

// Pabrik pembuat uploader untuk subdirektori & nama field tertentu.
function makeUploader(subdir, fieldName) {
  const dir = path.join(__dirname, '../../uploads', subdir);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = ALLOWED[file.mimetype] || '.bin';
      cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
    },
  });

  const middleware = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024, files: 1 }, // maks 2 MB, satu berkas
  }).single(fieldName);

  return { dir, middleware };
}

const avatars = makeUploader('avatars', 'avatar');
const logos = makeUploader('logos', 'logo');

module.exports = {
  uploadAvatar: avatars.middleware,
  AVATAR_DIR: avatars.dir,
  uploadLogo: logos.middleware,
  LOGO_DIR: logos.dir,
};
