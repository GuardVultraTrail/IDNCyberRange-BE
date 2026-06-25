// ===========================================================================
// Utilitas JWT — membungkus jsonwebtoken agar konsisten di seluruh aplikasi.
// ===========================================================================
const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Membuat token JWT.
 * PENTING (keamanan): payload SENGAJA hanya berisi data minimal & tidak sensitif
 * (id, username, role). JANGAN pernah memasukkan password/hash ke dalam token —
 * payload JWT hanya di-encode base64, BUKAN dienkripsi, jadi siapa pun bisa
 * membacanya. Role disertakan untuk kebutuhan RBAC sisi klien (tampilan saja);
 * otorisasi sebenarnya tetap divalidasi ulang di server.
 */
function signToken(user) {
  const payload = {
    sub: user.id, // subject = id user
    username: user.username,
    role: user.role?.name || user.role, // nama role: "ADMIN" / "PESERTA"
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

/**
 * Memverifikasi & mendekode token. Melempar error bila token tidak valid
 * atau kedaluwarsa (ditangani oleh middleware verifyToken).
 */
function verifyJwt(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = { signToken, verifyJwt };
