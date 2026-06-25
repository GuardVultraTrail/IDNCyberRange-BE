// ===========================================================================
// Seed database — mengisi data awal IDN Cyber Range.
// Membuat: 2 Role (ADMIN, PESERTA), beberapa user, dan beberapa lab milik
// user yang berbeda-beda. Distribusi kepemilikan ini sengaja dibuat agar
// skenario BOLA (mengakses lab milik user lain) bisa diuji langsung.
// ===========================================================================
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

async function main() {
  console.log('🌱 Mulai seeding...');

  // 1) Roles (RBAC dinamis — disimpan di DB)
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Administrator platform — akses penuh.' },
  });
  const pesertaRole = await prisma.role.upsert({
    where: { name: 'PESERTA' },
    update: {},
    create: { name: 'PESERTA', description: 'Peserta lab — akses terbatas pada objek miliknya.' },
  });

  // 2) Users
  const hash = (pw) => bcrypt.hashSync(pw, SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@idn.id',
      password: hash('Admin#1234'),
      displayName: 'Administrator',
      bio: 'Pengelola platform IDN Cyber Range.',
      // xp & level dibuat konsisten: level = floor(xp/100)+1. 9850 -> Lvl 99.
      xp: 9850,
      level: 99,
      roleId: adminRole.id,
    },
  });

  const rangga = await prisma.user.upsert({
    where: { username: 'ranggaputra' },
    update: { xp: 7650, level: 77 },
    create: {
      username: 'ranggaputra',
      email: 'rangga@idn.id',
      password: hash('Peserta#1234'),
      displayName: 'Rangga Putra',
      bio: 'Mahasiswa keamanan siber. Penggemar web exploitation.',
      // 7650 -> Lvl 77 (floor(7650/100)+1). Tier ELITE.
      xp: 7650,
      level: 77,
      roleId: pesertaRole.id,
    },
  });

  const nox = await prisma.user.upsert({
    where: { username: 'n0xpwn' },
    update: { xp: 14150, level: 142 },
    create: {
      username: 'n0xpwn',
      email: 'nox@protonmail.com',
      password: hash('Peserta#1234'),
      // 14150 -> Lvl 142 (floor(14150/100)+1). Tier MASTER.
      xp: 14150,
      level: 142,
      roleId: pesertaRole.id,
    },
  });

  // Hacker demo tambahan agar papan peringkat terisi. `flags` = jumlah flag
  // yang akan di-seed-kan untuk user tsb (lihat bagian capture di bawah).
  const extraHackers = [
    { username: 'sh3llmaster', displayName: 'Shell Master', xp: 13750, level: 138, flags: 5 },
    { username: 'r00tkit', displayName: 'Root Kit', xp: 13050, level: 131, flags: 5 },
    { username: 'bitflip', displayName: 'Bit Flip', xp: 11950, level: 120, flags: 4 },
    { username: 'nullbyte', displayName: 'Null Byte', xp: 11750, level: 118, flags: 4 },
    { username: 'phr34k', displayName: 'Phreak', xp: 11150, level: 112, flags: 3 },
    { username: 'segf4ult', displayName: 'Seg Fault', xp: 10750, level: 108, flags: 3 },
    { username: 'daem0n', displayName: 'Daemon', xp: 10050, level: 101, flags: 2 },
  ];

  // Peserta filler (semuanya di bawah rangga) supaya papan peringkat > 20 user
  // dan pagination (20 per halaman) bisa diuji. xp & level konsisten via formula.
  const fillerNames = ['v0idz', 'gl1tch', 'tr4ce', 'byt3r', 'x0rd', 'crypt0', 'p4yl0ad', 'sh4d0w', 'm4lw4re', 'sn1ffer', 'st4ckz', 'h34pz', '0verfl0w', 'd3bugz', 'k3rnelz', 'f4ult'];
  fillerNames.forEach((name, i) => {
    const xp = 7000 - i * 380; // semua < 7650 (xp rangga)
    extraHackers.push({ username: name, displayName: null, xp, level: Math.floor(xp / 100) + 1, flags: i % 3 });
  });
  const demoUsers = [];
  for (const h of extraHackers) {
    const u = await prisma.user.upsert({
      where: { username: h.username },
      update: { xp: h.xp, level: h.level },
      create: {
        username: h.username,
        email: `${h.username}@idn.id`,
        password: hash('Peserta#1234'),
        displayName: h.displayName,
        xp: h.xp,
        level: h.level,
        roleId: pesertaRole.id,
      },
    });
    demoUsers.push({ ...u, flags: h.flags });
  }

  // 3) Labs — sebagian milik admin (lab resmi/publik), sebagian milik peserta
  // (lab submission). Inilah data yang memungkinkan pengujian BOLA:
  // peserta `rangga` TIDAK boleh mengedit lab milik `nox` atau `admin`.
  // Tiap lab kini punya `flags` (jumlah bebas) & `guidedEnabled`.
  const labs = [
    {
      name: 'Overpass', description: 'Web exploitation & privilege escalation di Linux.',
      difficulty: 'EASY', os: 'LINUX', ipAddress: '10.10.11.42', port: '22, 80',
      status: 'ACTIVE', published: true, guidedEnabled: true, ownerId: admin.id,
      flags: [
        { label: 'User Flag', value: 'IDN{ov3rp4ss_us3r}', points: 20 },
        { label: 'Root Flag', value: 'IDN{ov3rp4ss_pwn3d}', points: 50 },
      ],
    },
    {
      name: 'Sentinel', description: 'Active Directory enumeration & lateral movement.',
      difficulty: 'MEDIUM', os: 'WINDOWS', ipAddress: '10.10.11.51', port: '3389, 445',
      status: 'ACTIVE', published: true, guidedEnabled: false, ownerId: admin.id,
      flags: [
        { label: 'User Flag', value: 'IDN{s3nt1nel_us3r}', points: 20 },
        { label: 'Root Flag', value: 'IDN{s3nt1nel_1s_down}', points: 50 },
      ],
    },
    {
      name: 'Kerberoast', description: 'Serangan Kerberos pada domain Windows.',
      difficulty: 'HARD', os: 'WINDOWS', ipAddress: '10.10.11.63', port: '88, 389',
      status: 'ACTIVE', published: true, guidedEnabled: false, ownerId: nox.id,
      flags: [{ label: 'Root Flag', value: 'IDN{r0ast_the_t1ck3t}', points: 60 }],
    },
    {
      name: 'BlindSQL', description: 'Blind SQL injection sampai remote code execution.',
      difficulty: 'MEDIUM', os: 'LINUX', ipAddress: '10.10.11.27', port: '80, 3306',
      status: 'RETIRED', published: true, guidedEnabled: false, ownerId: nox.id,
      flags: [{ label: 'Root Flag', value: 'IDN{bl1nd_but_d34dly}', points: 50 }],
    },
    {
      // Lab DRAFT milik rangga — belum publish. Hanya rangga & admin yang boleh melihat.
      name: 'ZeroDay', description: 'Eksploitasi binary tingkat lanjut & ROP chain.',
      difficulty: 'INSANE', os: 'LINUX', ipAddress: '10.10.11.99', port: '9001',
      status: 'DRAFT', published: false, guidedEnabled: true, ownerId: rangga.id,
      flags: [{ label: 'Root Flag', value: 'IDN{0d4y_m4st3rm1nd}', points: 80 }],
    },
  ];

  for (const def of labs) {
    const { flags, ...fields } = def;
    const existing = await prisma.lab.findFirst({ where: { name: fields.name } });
    let lab;
    if (existing) {
      lab = await prisma.lab.update({ where: { id: existing.id }, data: fields });
      await prisma.labFlag.deleteMany({ where: { labId: lab.id } });
    } else {
      lab = await prisma.lab.create({ data: fields });
    }
    await prisma.labFlag.createMany({
      data: flags.map((f, i) => ({ labId: lab.id, order: i + 1, label: f.label, value: f.value, points: f.points })),
    });
  }

  // Tambah contoh task Guided Mode untuk Overpass (idempotent sederhana)
  const overpass = await prisma.lab.findFirst({ where: { name: 'Overpass' } });
  if (overpass) {
    await prisma.labTask.deleteMany({ where: { labId: overpass.id } });
    await prisma.labTask.createMany({
      data: [
        { labId: overpass.id, order: 1, question: 'Berapa jumlah port TCP yang terbuka?', answer: '2', hint: 'nmap -p- -T4 <IP>' },
        { labId: overpass.id, order: 2, question: 'Layanan apa yang berjalan pada port 80?', answer: 'http', hint: 'Gunakan nmap -sV.' },
      ],
    });
  }

  // 4) Progress demo untuk ranggaputra agar dashboard tidak kosong.
  //    (Idempotent: bersihkan dulu progress lama milik rangga.)
  const blindsql = await prisma.lab.findFirst({ where: { name: 'BlindSQL' } });
  const sentinel = await prisma.lab.findFirst({ where: { name: 'Sentinel' } });
  const overpassTasks = overpass
    ? await prisma.labTask.findMany({ where: { labId: overpass.id }, orderBy: { order: 'asc' } })
    : [];

  await prisma.labTaskSolve.deleteMany({ where: { userId: rangga.id } });
  await prisma.submission.deleteMany({ where: { userId: rangga.id } });
  await prisma.favorite.deleteMany({ where: { userId: rangga.id } });

  // Rangga menyelesaikan 1 dari 2 task Overpass -> Overpass "In progress" (50%).
  if (overpassTasks[0]) {
    await prisma.labTaskSolve.create({
      data: { userId: rangga.id, taskId: overpassTasks[0].id, labId: overpass.id },
    });
  }
  // Rangga menangkap root flag BlindSQL -> lab "solved".
  if (blindsql) {
    const blindRoot = await prisma.labFlag.findFirst({ where: { labId: blindsql.id }, orderBy: { order: 'asc' } });
    if (blindRoot) {
      await prisma.submission.create({ data: { userId: rangga.id, labId: blindsql.id, flagId: blindRoot.id } });
    }
  }
  // Favorit Rangga.
  const favLabIds = [overpass?.id, sentinel?.id].filter(Boolean);
  if (favLabIds.length) {
    await prisma.favorite.createMany({ data: favLabIds.map((labId) => ({ userId: rangga.id, labId })) });
  }

  // 5) Capture flag demo untuk hacker tambahan -> mengisi kolom "Flags" di
  //    papan peringkat. Diambil dari flag lab yang published.
  const publishedFlags = await prisma.labFlag.findMany({
    where: { lab: { published: true } },
    select: { id: true, labId: true },
    orderBy: { id: 'asc' },
  });
  for (const u of demoUsers) {
    await prisma.submission.deleteMany({ where: { userId: u.id } });
    const picks = publishedFlags.slice(0, Math.min(u.flags, publishedFlags.length));
    if (picks.length) {
      await prisma.submission.createMany({
        data: picks.map((f) => ({ userId: u.id, labId: f.labId, flagId: f.id })),
      });
    }
  }

  console.log('✅ Seeding selesai.');
  console.log('   Admin    -> username: admin        password: Admin#1234');
  console.log('   Peserta  -> username: ranggaputra  password: Peserta#1234');
  console.log('   Peserta  -> username: n0xpwn       password: Peserta#1234');
}

main()
  .catch((e) => {
    console.error('❌ Seeding gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
