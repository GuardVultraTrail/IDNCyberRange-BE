// ===========================================================================
// Pemuatan & validasi variabel lingkungan.
// Aplikasi langsung berhenti bila JWT_SECRET belum diisi — mencegah server
// jalan dengan secret kosong/lemah yang membahayakan keseluruhan skema JWT.
// ===========================================================================
require('dotenv').config();

const env = {
  PORT: Number(process.env.PORT || 4000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
};

if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) {
  // Gagal cepat (fail-fast): lebih baik server tidak start daripada berjalan
  // dengan konfigurasi keamanan yang tidak aman.
  throw new Error(
    '[FATAL] JWT_SECRET belum diset atau terlalu pendek. Isi di file .env (min. 16 karakter).'
  );
}

module.exports = env;
