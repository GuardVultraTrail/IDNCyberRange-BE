// ===========================================================================
// Titik masuk server — menjalankan HTTP listener & menangani shutdown rapi.
// ===========================================================================
const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

const server = app.listen(env.PORT, () => {
  console.log(`🚀 IDN Cyber Range API berjalan di http://localhost:${env.PORT}`);
  console.log(`   Mode: ${env.NODE_ENV} | CORS origin: ${env.CORS_ORIGIN}`);
});

// Matikan koneksi DB dengan rapi saat proses dihentikan.
async function shutdown(signal) {
  console.log(`\n${signal} diterima, menutup server...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
