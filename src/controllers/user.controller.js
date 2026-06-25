// ===========================================================================
// CONTROLLER: User (administrasi pengguna)
// ---------------------------------------------------------------------------
// Seluruh aksi di sini bersifat administratif. Pembatasan role ke ADMIN
// dilakukan di routes (requireRole('ADMIN')). Controller menambahkan
// pengaman tambahan agar admin tidak mengunci dirinya sendiri.
// ===========================================================================
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Parameter id tidak valid.');
  return id;
}

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  level: true,
  status: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
  _count: { select: { labs: true } },
};

// GET /api/users?q=...  (ADMIN)
const listUsers = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const where = q
    ? { OR: [{ username: { contains: q } }, { email: { contains: q } }] }
    : {};
  const users = await prisma.user.findMany({
    where,
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: users });
});

// PATCH /api/users/:id/role  (ADMIN) — set role berdasarkan nama role.
const setUserRole = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const roleName = String(req.body.role || '').toUpperCase();

  if (!['ADMIN', 'PESERTA'].includes(roleName)) {
    throw ApiError.badRequest('Role harus ADMIN atau PESERTA.');
  }
  // Pengaman: admin tidak boleh menurunkan role dirinya sendiri (anti lockout).
  if (id === req.user.id && roleName !== 'ADMIN') {
    throw ApiError.forbidden('Anda tidak dapat menurunkan role akun Anda sendiri.');
  }

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw ApiError.notFound('Role tidak ditemukan.');

  const user = await prisma.user.update({
    where: { id },
    data: { roleId: role.id },
    select: USER_SELECT,
  });
  res.json({ success: true, data: user });
});

// PATCH /api/users/:id/status  (ADMIN) — ban / unban.
const setUserStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const status = String(req.body.status || '').toUpperCase();

  if (!['ACTIVE', 'BANNED'].includes(status)) {
    throw ApiError.badRequest('Status harus ACTIVE atau BANNED.');
  }
  // Pengaman: admin tidak boleh memblokir dirinya sendiri.
  if (id === req.user.id && status === 'BANNED') {
    throw ApiError.forbidden('Anda tidak dapat memblokir akun Anda sendiri.');
  }

  const user = await prisma.user.update({
    where: { id },
    data: { status },
    select: USER_SELECT,
  });
  res.json({ success: true, data: user });
});

// DELETE /api/users/:id  (ADMIN)
const deleteUser = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  // Pengaman: admin tidak boleh menghapus akunnya sendiri.
  if (id === req.user.id) {
    throw ApiError.forbidden('Anda tidak dapat menghapus akun Anda sendiri.');
  }
  await prisma.user.delete({ where: { id } });
  res.json({ success: true, data: { id } });
});

// GET /api/leaderboard  (ADMIN & PESERTA) — papan peringkat publik internal.
// Hanya mengekspos data non-sensitif (username, level). Email/role/password
// TIDAK disertakan. Boleh diakses semua user terautentikasi.
const getLeaderboard = asyncHandler(async (req, res) => {
  const meId = req.user.id;

  // Hanya peserta yang masuk papan peringkat (admin dikecualikan).
  // Diurutkan berdasarkan XP (poin) menurun.
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { name: { not: 'ADMIN' } } },
    select: { id: true, username: true, displayName: true, avatarUrl: true, level: true, xp: true },
    orderBy: [{ xp: 'desc' }, { id: 'asc' }],
  });

  // Jumlah flag yang ditangkap tiap user (untuk kolom Flags).
  const flagGroups = await prisma.submission.groupBy({ by: ['userId'], _count: { _all: true } });
  const flagsByUser = {};
  flagGroups.forEach((g) => (flagsByUser[g.userId] = g._count._all));

  const ranked = users.map((u, i) => ({
    rank: i + 1,
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    level: u.level,
    points: u.xp || 0,
    flags: flagsByUser[u.id] || 0,
    isYou: u.id === meId,
  }));

  // Top-3 (podium) SELALU dikirim & tampil di semua halaman. Sisanya
  // (peringkat 4+) dibagi per halaman, 10 per halaman.
  const PER_PAGE = 10;
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(req.query.page, 10) || 1), totalPages);
  const start = (page - 1) * PER_PAGE;
  const items = rest.slice(start, start + PER_PAGE);

  // me = baris user yang login (bisa berada di halaman lain -> dipin di UI).
  const me = ranked.find((r) => r.isYou) || null;

  res.json({ success: true, data: { podium, items, me, page, perPage: PER_PAGE, total, totalPages } });
});

// GET /api/players/:id  (ADMIN & PESERTA) — profil PUBLIK user lain.
// Hanya mengekspos data non-sensitif (TIDAK ada email/password). Boleh dilihat
// semua user terautentikasi. Rank dihitung memakai count (skalabel) dan
// konsisten dengan urutan leaderboard (xp desc, tie-break id asc).
const getPublicProfile = asyncHandler(async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) throw ApiError.badRequest('Username tidak valid.');

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true, username: true, displayName: true, bio: true, avatarUrl: true,
      level: true, xp: true, status: true, createdAt: true,
      role: { select: { name: true } },
    },
  });
  if (!user) throw ApiError.notFound('User tidak ditemukan.');

  const [flags, tasksSolved] = await Promise.all([
    prisma.submission.count({ where: { userId: user.id } }),
    prisma.labTaskSolve.count({ where: { userId: user.id } }),
  ]);

  // Rank hanya untuk peserta aktif (admin & banned tidak masuk papan peringkat).
  let rank = null;
  if (user.status === 'ACTIVE' && user.role.name !== 'ADMIN') {
    const baseWhere = { status: 'ACTIVE', role: { name: { not: 'ADMIN' } } };
    const [higher, sameXpEarlier] = await Promise.all([
      prisma.user.count({ where: { ...baseWhere, xp: { gt: user.xp } } }),
      prisma.user.count({ where: { ...baseWhere, xp: user.xp, id: { lt: user.id } } }),
    ]);
    rank = higher + sameXpEarlier + 1;
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      role: user.role.name,
      status: user.status,
      level: user.level,
      points: user.xp || 0,
      flags,
      tasksSolved,
      rank,
      joinedAt: user.createdAt,
      isYou: user.id === req.user.id,
    },
  });
});

// GET /api/users/stats  (ADMIN) — ringkasan untuk dashboard admin.
const getStats = asyncHandler(async (req, res) => {
  const [totalMachines, activeMachines, totalUsers, activeUsers, byDifficulty] = await Promise.all([
    prisma.lab.count(),
    prisma.lab.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.lab.groupBy({ by: ['difficulty'], _count: { _all: true } }),
  ]);

  const distribution = { EASY: 0, MEDIUM: 0, HARD: 0, INSANE: 0 };
  byDifficulty.forEach((d) => {
    distribution[d.difficulty] = d._count._all;
  });

  res.json({
    success: true,
    data: { totalMachines, activeMachines, totalUsers, activeUsers, distribution },
  });
});

module.exports = { listUsers, setUserRole, setUserStatus, deleteUser, getStats, getLeaderboard, getPublicProfile };
