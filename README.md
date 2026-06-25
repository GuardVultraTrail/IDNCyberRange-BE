# Backend — IDN Cyber Range API

REST API berbasis **Express.js + Prisma + MySQL**. Fokus: RBAC & mitigasi BOLA.

## Setup
```bash
cp .env.example .env          # isi DATABASE_URL & JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev                   # http://localhost:4000
```

## Daftar Endpoint

| Method | Path | Akses | Keterangan |
|--------|------|-------|------------|
| POST | `/api/auth/register` | publik | Daftar peserta (role dipaksa `PESERTA`) |
| POST | `/api/auth/login` | publik | Login (username/email + password) |
| GET | `/api/auth/me` | terautentikasi | Profil user dari token |
| PATCH | `/api/profile` | ADMIN, PESERTA | Ubah display name & bio **milik sendiri** (anti-IDOR) |
| PATCH | `/api/profile/password` | ADMIN, PESERTA | Ganti password (verifikasi password lama) |
| POST | `/api/profile/avatar` | ADMIN, PESERTA | Unggah foto profil (multipart, validasi tipe/ukuran) |
| GET | `/api/labs` | ADMIN, PESERTA | List lab (difilter server sesuai role) |
| GET | `/api/labs/:id` | ADMIN, PESERTA | Detail lab — **cek BOLA** |
| POST | `/api/labs` | ADMIN, PESERTA | Buat lab (owner = pemanggil) |
| PUT | `/api/labs/:id` | ADMIN, PESERTA | Ubah lab — **cek kepemilikan** |
| DELETE | `/api/labs/:id` | ADMIN, PESERTA | Hapus lab — **cek kepemilikan** |
| POST | `/api/labs/:id/tasks/:taskId/solve` | ADMIN, PESERTA | Submit jawaban Guided Mode (dicek server, **anti-IDOR**) |
| POST | `/api/labs/:id/flag` | ADMIN, PESERTA | Submit flag (by `flagId`, fleksibel >1), dicek server |
| POST/DELETE | `/api/labs/:id/favorite` | ADMIN, PESERTA | Tandai/lepas favorit |
| GET | `/api/dashboard` | ADMIN, PESERTA | Agregasi metrik dashboard (points, flags, streak, progress) |
| GET | `/api/leaderboard` | ADMIN, PESERTA | Papan peringkat (data non-sensitif) |
| GET | `/api/users` | ADMIN | Daftar user |
| GET | `/api/users/stats` | ADMIN | Statistik dashboard |
| PATCH | `/api/users/:id/role` | ADMIN | Ubah role |
| PATCH | `/api/users/:id/status` | ADMIN | Ban / unban |
| DELETE | `/api/users/:id` | ADMIN | Hapus user |

## Berkas keamanan inti
- `src/middleware/verifyToken.js` — autentikasi JWT.
- `src/middleware/requireRole.js` — RBAC dinamis (tingkat fungsi).
- `src/controllers/lab.controller.js` — mitigasi BOLA (tingkat objek), berkomentar lengkap.

Bentuk respons konsisten: `{ "success": true, "data": ... }` atau `{ "success": false, "error": { "code", "message" } }`.
