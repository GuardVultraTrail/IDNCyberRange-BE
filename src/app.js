// ===========================================================================
// Aplikasi Express — perakitan middleware & routing.
// ===========================================================================
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const labRoutes = require('./routes/lab.routes');
const userRoutes = require('./routes/user.routes');
const profileRoutes = require('./routes/profile.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const playersRoutes = require('./routes/players.routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// helmet -> mengeset header HTTP keamanan (mis. X-Content-Type-Options,
// menonaktifkan X-Powered-By) untuk mengurangi permukaan serangan.
app.use(helmet());

// CORS. Di PRODUKSI dibatasi ke origin yang terdaftar di CORS_ORIGIN
// (boleh beberapa, dipisah koma; atau "*" untuk memantulkan semua origin).
// Di DEVELOPMENT, origin dipantulkan otomatis agar mudah diakses dari komputer
// lain di jaringan lokal (LAN) tanpa perlu mengatur IP secara manual.
const allowedOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      // Request tanpa Origin (mis. curl/Postman, same-origin) selalu diizinkan.
      if (!origin) return cb(null, true);
      // Mode dev: pantulkan origin apa pun (memudahkan pengujian LAN).
      if (env.NODE_ENV !== 'production') return cb(null, true);
      // Mode produksi: hanya origin yang di-whitelist (atau "*").
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);

// Batasi ukuran body untuk mencegah payload raksasa (DoS sederhana).
app.use(express.json({ limit: '100kb' }));
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'idn-cyber-range-api' } });
});

// Berkas statis (foto profil). Disajikan dari direktori khusus 'uploads'.
// PENTING: helmet secara default memasang header `Cross-Origin-Resource-Policy:
// same-origin` yang membuat browser MEMBLOKIR pemuatan gambar lintas origin
// (frontend :3000 memuat gambar dari API :4000). Untuk aset publik seperti
// avatar, kita longgarkan khusus path ini menjadi `cross-origin`.
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '../uploads'))
);

// Routing utama
app.use('/api/auth', authRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/players', playersRoutes);

// 404 + error handler terpusat (harus paling akhir).
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
