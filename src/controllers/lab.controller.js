// ===========================================================================
// CONTROLLER: Lab (CRUD)
// ---------------------------------------------------------------------------
// INTI SKRIPSI: di sinilah mitigasi BOLA (Broken Object Level Authorization)
// diterapkan. BOLA terjadi ketika API hanya memeriksa "apakah user login?"
// (autentikasi) tetapi LUPA memeriksa "apakah user ini berhak atas OBJEK
// SPESIFIK yang diminta?" (otorisasi tingkat-objek). Akibatnya, mengganti
// `:id` di URL (mis. /api/labs/5 -> /api/labs/6) bisa membocorkan/mengubah
// data milik orang lain.
//
// Aturan otorisasi tingkat-objek pada modul ini:
//   - ADMIN          : boleh membaca & mengubah SEMUA lab.
//   - PESERTA        : hanya boleh membaca lab yang published ATAU miliknya;
//                      hanya boleh mengubah/menghapus lab MILIKNYA sendiri.
//   - Kepemilikan ditentukan oleh field Lab.ownerId == req.user.id.
// ===========================================================================
const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { LOGO_DIR } = require('../middleware/upload');

const ADMIN = 'ADMIN';

// Field aman untuk listing publik — TIDAK menyertakan flag (data sensitif).
const PUBLIC_LAB_SELECT = {
  id: true,
  name: true,
  description: true,
  difficulty: true,
  os: true,
  logoUrl: true,
  ipAddress: true,
  port: true,
  status: true,
  published: true,
  guidedEnabled: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, username: true } },
  _count: { select: { tasks: true, flags: true } },
};

// ---------------------------------------------------------------------------
// Helper anti-BOLA: ambil lab berdasarkan id, lalu kembalikan beserta
// flag boolean apakah pemanggil adalah pemilik/admin. Mengembalikan 404 bila
// lab tidak ada (jangan membocorkan info lebih dari yang perlu).
// ---------------------------------------------------------------------------
async function getLabAndAccess(labId, requester) {
  const lab = await prisma.lab.findUnique({
    where: { id: labId },
    include: {
      owner: { select: { id: true, username: true } },
      tasks: { orderBy: { order: 'asc' } },
      flags: { orderBy: { order: 'asc' } },
    },
  });
  if (!lab) throw ApiError.notFound('Lab tidak ditemukan.');

  const isOwner = lab.ownerId === requester.id;
  const isAdmin = requester.role === ADMIN;
  return { lab, isOwner, isAdmin, canModify: isOwner || isAdmin };
}

// Parse & validasi id dari URL menjadi integer. Id yang bukan angka langsung
// ditolak (mencegah query aneh / injeksi tipe).
function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest('Parameter id tidak valid.');
  }
  return id;
}

// ---------------------------------------------------------------------------
// GET /api/labs
// Daftar lab. Filter ditentukan SERVER berdasarkan identitas pemanggil:
//   - Admin   : semua lab.
//   - Peserta : lab yang published ATAU yang dimilikinya.
// Dengan begitu, draft milik orang lain tidak pernah bocor di listing.
// ---------------------------------------------------------------------------
const listLabs = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === ADMIN;

  const where = isAdmin
    ? {} // admin melihat semua
    : {
        // peserta: published (publik) ATAU lab miliknya sendiri
        OR: [{ published: true }, { ownerId: req.user.id }],
      };

  const labs = await prisma.lab.findMany({
    where,
    select: PUBLIC_LAB_SELECT,
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: labs });
});

// ---------------------------------------------------------------------------
// GET /api/labs/:id
// Mengambil satu lab. TITIK RAWAN BOLA UTAMA.
// Pengecekan: lab yang TIDAK published hanya boleh diakses pemilik atau admin.
// Flag (userFlag/rootFlag) HANYA disertakan untuk pemilik/admin.
// ---------------------------------------------------------------------------
const getLab = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { lab, isOwner, isAdmin, canModify } = await getLabAndAccess(id, req.user);

  // --- Pengecekan otorisasi tingkat-objek (anti-BOLA) ---
  // Lab draft/privat: tolak siapa pun selain pemilik & admin, MESKIPUN tokennya
  // valid. Inilah yang membedakan API aman vs API rentan BOLA.
  if (!lab.published && !canModify) {
    // Catatan: untuk benar-benar menyembunyikan keberadaan objek, bisa juga
    // dikembalikan 404 alih-alih 403. Di sini dipakai 403 agar pesan jelas
    // untuk keperluan demonstrasi/skripsi.
    throw ApiError.forbidden('Anda tidak berhak mengakses lab ini.');
  }

  // Susun respons. Flag hanya diikutkan bila pemanggil pemilik/admin.
  const response = {
    id: lab.id,
    name: lab.name,
    description: lab.description,
    difficulty: lab.difficulty,
    os: lab.os,
    logoUrl: lab.logoUrl,
    ipAddress: lab.ipAddress,
    port: lab.port,
    status: lab.status,
    published: lab.published,
    guidedEnabled: lab.guidedEnabled,
    ownerId: lab.ownerId,
    owner: lab.owner,
    createdAt: lab.createdAt,
    updatedAt: lab.updatedAt,
    // Tugas Guided Mode: jawaban hanya diekspos ke pemilik/admin; peserta biasa
    // hanya melihat pertanyaan & hint (jawaban disembunyikan agar tidak bocor).
    tasks: lab.tasks.map((t) => ({
      id: t.id,
      order: t.order,
      question: t.question,
      hint: t.hint,
      ...(canModify ? { answer: t.answer } : {}),
    })),
    // Daftar flag: label & poin tampil untuk semua, tetapi NILAI flag rahasia
    // hanya diekspos ke pemilik/admin (peserta cukup tahu ada flag apa saja).
    flags: lab.flags.map((f) => ({
      id: f.id,
      order: f.order,
      label: f.label,
      points: f.points,
      ...(canModify ? { value: f.value } : {}),
    })),
  };

  // Progress milik pemanggil (diikat ke req.user.id) -> agar UI menandai task
  // yang sudah diselesaikan, flag yang sudah ditangkap, dan status favorit.
  const [solves, subs, fav] = await Promise.all([
    prisma.labTaskSolve.findMany({ where: { userId: req.user.id, labId: lab.id }, select: { taskId: true } }),
    prisma.submission.findMany({ where: { userId: req.user.id, labId: lab.id }, select: { flagId: true } }),
    prisma.favorite.findFirst({ where: { userId: req.user.id, labId: lab.id } }),
  ]);
  response.solvedTaskIds = solves.map((s) => s.taskId);
  response.capturedFlagIds = subs.map((s) => s.flagId);
  response.isFavorite = !!fav;

  res.json({ success: true, data: response, meta: { isOwner, isAdmin } });
});

// ---------------------------------------------------------------------------
// POST /api/labs
// Membuat lab baru. Anti-BOLA/anti privilege-escalation:
//   - ownerId DIAMBIL DARI TOKEN (req.user.id), BUKAN dari body. Sehingga
//     peserta tidak bisa membuat lab atas nama (a.n.) user lain.
// ---------------------------------------------------------------------------
const createLab = asyncHandler(async (req, res) => {
  const { tasks = [], flags = [], guidedEnabled = true, ...labData } = req.body;

  // Bila Guided Mode dimatikan, abaikan tasks (lab hanya berbasis flag).
  const effectiveTasks = guidedEnabled ? tasks : [];

  // Visibilitas diturunkan dari status: DRAFT = privat, selain itu publik.
  const published = (labData.status || 'DRAFT') !== 'DRAFT';

  const lab = await prisma.lab.create({
    data: {
      ...labData,
      published,
      guidedEnabled,
      // Pemilik = pembuat (dari token terverifikasi). Field ini TIDAK diambil
      // dari input klien.
      ownerId: req.user.id,
      flags: {
        create: flags.map((f, i) => ({
          order: f.order ?? i + 1,
          label: f.label,
          value: f.value,
          points: f.points ?? 50,
        })),
      },
      tasks: {
        create: effectiveTasks.map((t, i) => ({
          order: t.order ?? i + 1,
          question: t.question,
          answer: t.answer,
          hint: t.hint ?? null,
        })),
      },
    },
    include: { owner: { select: { id: true, username: true } }, tasks: true, flags: true },
  });

  res.status(201).json({ success: true, data: lab });
});

// ---------------------------------------------------------------------------
// PUT /api/labs/:id
// Memperbarui lab. TITIK RAWAN BOLA. Pola aman:
//   1) Ambil objek dari DB lebih dulu.
//   2) Verifikasi pemanggil = pemilik ATAU admin. Bila bukan -> 403, berhenti.
//   3) Buang field kepemilikan (ownerId) dari payload agar tidak bisa
//      dialihkan ke user lain.
// ---------------------------------------------------------------------------
const updateLab = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  // Langkah 1 & 2: muat objek lalu cek hak akses tingkat-objek.
  const { canModify } = await getLabAndAccess(id, req.user);
  if (!canModify) {
    // Peserta mencoba mengubah lab milik orang lain -> diblokir di sini.
    throw ApiError.forbidden('Anda hanya dapat mengubah lab milik Anda sendiri.');
  }

  // Langkah 3: pisahkan tasks & flags; JANGAN izinkan perubahan ownerId.
  const { tasks, flags, ownerId, ...labData } = req.body;
  delete labData.ownerId; // pertahanan ekstra walau validator sudah menyaringnya

  // Visibilitas mengikuti status (DRAFT = privat, lainnya = publik).
  if (labData.status) labData.published = labData.status !== 'DRAFT';

  // Bila Guided Mode dimatikan pada update ini, kosongkan tasks.
  const guidedOff = labData.guidedEnabled === false;

  const updated = await prisma.$transaction(async (tx) => {
    const lab = await tx.lab.update({ where: { id }, data: labData });

    // Ganti seluruh set flag bila dikirim (sinkron dengan form admin).
    if (Array.isArray(flags)) {
      await tx.labFlag.deleteMany({ where: { labId: id } });
      if (flags.length) {
        await tx.labFlag.createMany({
          data: flags.map((f, i) => ({
            labId: id,
            order: f.order ?? i + 1,
            label: f.label,
            value: f.value,
            points: f.points ?? 50,
          })),
        });
      }
    }

    // Ganti seluruh set tugas. Bila guided dimatikan -> hapus semua tugas.
    if (Array.isArray(tasks) || guidedOff) {
      await tx.labTask.deleteMany({ where: { labId: id } });
      const list = guidedOff ? [] : tasks || [];
      if (list.length) {
        await tx.labTask.createMany({
          data: list.map((t, i) => ({
            labId: id,
            order: t.order ?? i + 1,
            question: t.question,
            answer: t.answer,
            hint: t.hint ?? null,
          })),
        });
      }
    }
    return lab;
  });

  const full = await prisma.lab.findUnique({
    where: { id: updated.id },
    include: {
      owner: { select: { id: true, username: true } },
      tasks: { orderBy: { order: 'asc' } },
      flags: { orderBy: { order: 'asc' } },
    },
  });

  res.json({ success: true, data: full });
});

// ---------------------------------------------------------------------------
// DELETE /api/labs/:id
// Menghapus lab. TITIK RAWAN BOLA. Sama seperti update: cek kepemilikan dulu.
// ---------------------------------------------------------------------------
const deleteLab = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const { canModify } = await getLabAndAccess(id, req.user);
  if (!canModify) {
    throw ApiError.forbidden('Anda hanya dapat menghapus lab milik Anda sendiri.');
  }

  await prisma.lab.delete({ where: { id } });
  res.json({ success: true, data: { id } });
});

// ---------------------------------------------------------------------------
// POST /api/labs/:id/logo  (multipart: field "logo")
// Mengunggah logo machine. Sama seperti update: kepemilikan objek dicek dulu
// (hanya pemilik / admin). Middleware multer sudah memvalidasi tipe & ukuran.
// ---------------------------------------------------------------------------
const uploadLabLogo = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const { lab, canModify } = await getLabAndAccess(id, req.user);
  if (!canModify) {
    throw ApiError.forbidden('Anda hanya dapat mengubah lab milik Anda sendiri.');
  }
  if (!req.file) throw ApiError.badRequest('Tidak ada berkas logo yang diunggah.');

  const relPath = `/uploads/logos/${req.file.filename}`;

  // Hapus logo lama (jika ada). basename mencegah path traversal saat hapus.
  if (lab.logoUrl) {
    const oldPath = path.join(LOGO_DIR, path.basename(lab.logoUrl));
    fs.promises.unlink(oldPath).catch(() => {});
  }

  const updated = await prisma.lab.update({
    where: { id },
    data: { logoUrl: relPath },
    include: { owner: { select: { id: true, username: true } } },
  });

  res.json({ success: true, data: updated });
});

module.exports = { listLabs, getLab, createLab, updateLab, deleteLab, uploadLabLogo };
