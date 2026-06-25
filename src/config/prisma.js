// ===========================================================================
// Instance Prisma Client tunggal (singleton) yang dipakai seluruh aplikasi.
// Memakai satu instance mencegah kebocoran koneksi database.
// ===========================================================================
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
