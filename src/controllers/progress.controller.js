// ===========================================================================
// CONTROLLER: Progress (gamifikasi) — solve task, submit flag, favorit, dan
// agregasi dashboard.
// ---------------------------------------------------------------------------
// Catatan keamanan (relevan skripsi):
//   - Setiap pencatatan progress diikat ke `req.user.id` (dari token), TIDAK
//     PERNAH dari userId di body. Mencegah serangan IDOR/BOLA "menambah skor
//     atas nama user lain".
//   - Pencocokan jawaban & flag dilakukan DI SERVER. Jawaban benar tidak
//     dikirim ke peserta, sehingga tidak bisa dicurangi dari front-end.
// ===========================================================================
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const S = require('../config/scoring');

const ADMIN = 'ADMIN';

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Parameter id tidak valid.');
  return id;
}

// Hak BACA/MAIN lab: lab published, atau milik user, atau user admin.
function canViewLab(lab, user) {
  return lab.published || lab.ownerId === user.id || user.role === ADMIN;
}

// ---------------------------------------------------------------------------
// awardXp — menambah XP ke user lalu menyetel ulang level dari total XP.
// Dipanggil DI DALAM transaksi yang sama dengan pembuatan record solve/flag,
// sehingga XP hanya bertambah saat record BENAR-BENAR baru dibuat. Bila record
// sudah ada (unique constraint), pembuatan gagal -> transaksi rollback ->
// XP tidak ikut bertambah. Inilah kunci anti-cheat: spam endpoint dengan
// jawaban yang sama TIDAK menambah XP berulang.
// ---------------------------------------------------------------------------
async function awardXp(tx, userId, amount) {
  const u = await tx.user.findUnique({ where: { id: userId }, select: { xp: true } });
  const xp = (u.xp || 0) + amount;
  await tx.user.update({ where: { id: userId }, data: { xp, level: S.levelForXp(xp) } });
}

// ---------------------------------------------------------------------------
// POST /api/labs/:id/tasks/:taskId/solve   { answer }
// ---------------------------------------------------------------------------
const solveTask = asyncHandler(async (req, res) => {
  const labId = parseId(req.params.id);
  const taskId = parseId(req.params.taskId);
  const answer = (req.body.answer ?? '').toString().trim();
  if (!answer) throw ApiError.badRequest('Jawaban wajib diisi.');

  const task = await prisma.labTask.findUnique({ where: { id: taskId }, include: { lab: true } });
  // Validasi: task ada DAN benar-benar milik lab pada URL (cegah mismatch id).
  if (!task || task.labId !== labId) throw ApiError.notFound('Task tidak ditemukan pada lab ini.');
  if (!canViewLab(task.lab, req.user)) throw ApiError.forbidden('Anda tidak berhak mengakses lab ini.');

  // Cek jawaban di server (case-insensitive).
  const correct = answer.toLowerCase() === task.answer.trim().toLowerCase();
  if (!correct) return res.json({ success: true, data: { correct: false } });

  // Catat solve (idempotent via unique [userId,taskId]). Tugas Guided Mode
  // TIDAK memberi XP — solve hanya menandai progress & membuka langkah
  // berikutnya. Poin tetap diberikan saat menangkap flag.
  try {
    await prisma.labTaskSolve.create({ data: { userId: req.user.id, taskId, labId } });
  } catch (e) {
    if (e.code === 'P2002') {
      return res.json({ success: true, data: { correct: true, solved: true, alreadySolved: true } });
    }
    throw e;
  }

  res.json({ success: true, data: { correct: true, solved: true, taskId } });
});

// ---------------------------------------------------------------------------
// POST /api/labs/:id/flag   { flagId, value }
// Submit salah satu flag (fleksibel) milik lab. Nilai dicek di server.
// ---------------------------------------------------------------------------
const submitFlag = asyncHandler(async (req, res) => {
  const labId = parseId(req.params.id);
  const flagId = parseId(req.body.flagId);
  const value = (req.body.value ?? '').toString().trim();
  if (!value) throw ApiError.badRequest('Flag wajib diisi.');

  // Ambil flag beserta lab-nya, pastikan flag benar milik lab pada URL.
  const flag = await prisma.labFlag.findUnique({ where: { id: flagId }, include: { lab: true } });
  if (!flag || flag.labId !== labId) throw ApiError.notFound('Flag tidak ditemukan pada lab ini.');
  if (!canViewLab(flag.lab, req.user)) throw ApiError.forbidden('Anda tidak berhak mengakses lab ini.');

  // Flag dibandingkan persis (case-sensitive) di server.
  if (value !== flag.value) return res.json({ success: true, data: { correct: false } });

  const amount = flag.points ?? S.DEFAULT_FLAG_POINTS;
  // Catat capture + beri XP atomik, hanya saat capture baru (unique guard).
  try {
    await prisma.$transaction(async (tx) => {
      await tx.submission.create({ data: { userId: req.user.id, labId, flagId } });
      await awardXp(tx, req.user.id, amount);
    });
  } catch (e) {
    if (e.code === 'P2002') {
      return res.json({ success: true, data: { correct: true, captured: true, alreadyCaptured: true } });
    }
    throw e;
  }

  res.json({ success: true, data: { correct: true, captured: true, flagId, xpAwarded: amount } });
});

// ---------------------------------------------------------------------------
// POST/DELETE /api/labs/:id/favorite
// ---------------------------------------------------------------------------
const addFavorite = asyncHandler(async (req, res) => {
  const labId = parseId(req.params.id);
  const lab = await prisma.lab.findUnique({ where: { id: labId } });
  if (!lab) throw ApiError.notFound('Lab tidak ditemukan.');
  if (!canViewLab(lab, req.user)) throw ApiError.forbidden();
  await prisma.favorite.upsert({
    where: { userId_labId: { userId: req.user.id, labId } },
    update: {},
    create: { userId: req.user.id, labId },
  });
  res.json({ success: true, data: { favorite: true } });
});

const removeFavorite = asyncHandler(async (req, res) => {
  const labId = parseId(req.params.id);
  // deleteMany dibatasi userId pemanggil -> tidak bisa menghapus favorit user lain.
  await prisma.favorite.deleteMany({ where: { userId: req.user.id, labId } });
  res.json({ success: true, data: { favorite: false } });
});

// ---------- util tanggal untuk streak & tren ----------
const DAY_MS = 86400000;
function dayKey(d) {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${x.getUTCMonth()}-${x.getUTCDate()}`;
}
function computeDailyStreak(dates) {
  if (!dates.length) return 0;
  const set = new Set(dates.map(dayKey));
  let cur = new Date();
  // Bila belum ada aktivitas hari ini, streak boleh dihitung mulai kemarin.
  if (!set.has(dayKey(cur))) {
    cur = new Date(Date.now() - DAY_MS);
    if (!set.has(dayKey(cur))) return 0;
  }
  let streak = 0;
  while (set.has(dayKey(cur))) {
    streak++;
    cur = new Date(cur.getTime() - DAY_MS);
  }
  return streak;
}
function weeklyTrend(activities, weeks) {
  const now = Date.now();
  const buckets = new Array(weeks).fill(0);
  activities.forEach((a) => {
    const wk = Math.floor((now - new Date(a.t).getTime()) / (DAY_MS * 7));
    if (wk >= 0 && wk < weeks) buckets[weeks - 1 - wk] += a.p; // indeks terakhir = minggu ini
  });
  return buckets;
}

// ---------------------------------------------------------------------------
// GET /api/dashboard — agregasi metrik untuk dashboard peserta.
// Semua angka dihitung dari aktivitas NYATA milik user yang sedang login.
// ---------------------------------------------------------------------------
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === ADMIN;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, level: true, xp: true } });

  // Lab yang boleh diakses (untuk total flag & lookup judul).
  const labWhere = isAdmin ? {} : { OR: [{ published: true }, { ownerId: userId }] };
  const labs = await prisma.lab.findMany({
    where: labWhere,
    select: {
      id: true, name: true, difficulty: true, os: true, logoUrl: true, ownerId: true,
      owner: { select: { username: true } }, _count: { select: { tasks: true, flags: true } },
    },
  });
  const labById = {};
  labs.forEach((l) => (labById[l.id] = l));

  const [taskSolves, submissions, favorites] = await Promise.all([
    prisma.labTaskSolve.findMany({ where: { userId }, select: { labId: true, createdAt: true } }),
    prisma.submission.findMany({ where: { userId }, select: { labId: true, createdAt: true } }),
    prisma.favorite.findMany({ where: { userId }, select: { labId: true } }),
  ]);

  // Poin = total XP tersimpan (sumber kebenaran level). Konsisten dgn level.
  const points = user.xp || 0;

  // Total flag tersedia pada lab yang diakses (jumlah flag tiap lab).
  let flagsTotal = 0;
  labs.forEach((l) => (flagsTotal += l._count.flags));

  // Hitung per lab: jumlah task selesai & flag tertangkap milik user.
  const solvesByLab = {};
  taskSolves.forEach((s) => (solvesByLab[s.labId] = (solvesByLab[s.labId] || 0) + 1));
  const capByLab = {};
  submissions.forEach((s) => (capByLab[s.labId] = (capByLab[s.labId] || 0) + 1));

  // Progress lab = (task selesai + flag tertangkap) / (total task + total flag).
  const activeLabIds = new Set([...Object.keys(solvesByLab), ...Object.keys(capByLab)].map(Number));
  const inProgress = [];
  let solvedLabs = 0;
  activeLabIds.forEach((id) => {
    const lab = labById[id];
    if (!lab) return;
    const total = lab._count.tasks + lab._count.flags;
    const done = (solvesByLab[id] || 0) + (capByLab[id] || 0);
    const progress = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    if (progress >= 100) {
      solvedLabs++;
    } else {
      inProgress.push({ id: lab.id, name: lab.name, difficulty: lab.difficulty, os: lab.os, logoUrl: lab.logoUrl, ownerId: lab.ownerId, owner: lab.owner, progress });
    }
  });
  inProgress.sort((a, b) => b.progress - a.progress);

  const favLabs = favorites
    .map((f) => labById[f.labId])
    .filter(Boolean)
    .map((l) => ({ id: l.id, name: l.name, difficulty: l.difficulty, os: l.os, logoUrl: l.logoUrl, ownerId: l.ownerId, owner: l.owner }));

  // Streak & tren XP (dari timestamp aktivitas nyata).
  const allDates = [...taskSolves.map((a) => a.createdAt), ...submissions.map((a) => a.createdAt)];
  const streakDays = computeDailyStreak(allDates);
  // Tren XP hanya dari flag (sumber XP). Tugas tidak memberi XP.
  const activities = submissions.map((a) => ({ t: a.createdAt, p: S.DEFAULT_FLAG_POINTS }));
  const xpTrend = weeklyTrend(activities, 5);

  res.json({
    success: true,
    data: {
      username: user.username,
      level: user.level,
      points,
      levelXp: {
        current: S.xpIntoLevel(points),
        max: S.XP_PER_LEVEL,
        pct: Math.round((S.xpIntoLevel(points) / S.XP_PER_LEVEL) * 100),
      },
      flags: { captured: submissions.length, total: flagsTotal },
      solvedLabs,
      tasksSolved: taskSolves.length,
      streakDays,
      weekly: { current: xpTrend[xpTrend.length - 1], target: S.WEEKLY_TARGET_XP },
      xpTrend,
      inProgress,
      favorites: favLabs,
    },
  });
});

module.exports = { solveTask, submitFlag, addFavorite, removeFavorite, getDashboard };
