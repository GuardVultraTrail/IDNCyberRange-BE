// ===========================================================================
// Error handler terpusat.
// Catatan keamanan: pada mode produksi, pesan error internal (stack trace,
// detail Prisma) TIDAK dibocorkan ke klien agar tidak memberi petunjuk kepada
// penyerang. Hanya error operasional (ApiError) yang pesannya ditampilkan.
// ===========================================================================
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

// 404 untuk route yang tidak terdaftar
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Terjadi kesalahan pada server.';
  let code = err.code || 'INTERNAL_ERROR';

  // Tangani error unik Prisma (mis. duplikat username/email) tanpa membocorkan
  // detail query internal ke klien.
  if (err.code === 'P2002') {
    statusCode = 409;
    code = 'CONFLICT';
    const field = err.meta?.target?.join(', ') || 'field';
    message = `Data dengan ${field} tersebut sudah terdaftar.`;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Token tidak valid atau sudah kedaluwarsa.';
  } else if (err.name === 'MulterError') {
    // Error dari multer (mis. ukuran berkas melebihi batas).
    statusCode = 400;
    code = 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran gambar melebihi batas (maks 2 MB).' : 'Gagal mengunggah berkas.';
  }

  // Jangan bocorkan pesan internal yang tak terduga di produksi.
  if (statusCode >= 500 && env.NODE_ENV === 'production') {
    message = 'Terjadi kesalahan pada server.';
  }

  if (statusCode >= 500) {
    console.error('[ERROR]', err);
  }

  res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

module.exports = { errorHandler, notFoundHandler };
