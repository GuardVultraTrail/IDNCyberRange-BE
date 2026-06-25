// ===========================================================================
// Skema poin & kurva level (gamifikasi). Dipusatkan agar konsisten & mudah
// diaudit.
// ---------------------------------------------------------------------------
// Model leveling:
//   - Setiap aktivitas (solve task / capture flag) memberi XP.
//   - XP bersifat AKUMULATIF & disimpan di kolom User.xp (sumber kebenaran).
//   - Level diturunkan dari total XP: butuh XP_PER_LEVEL XP per kenaikan level.
//     level = floor(xp / XP_PER_LEVEL) + 1  -> monoton naik, tidak pernah turun.
// ===========================================================================
const XP_PER_LEVEL = 100;

module.exports = {
  // CATATAN: menjawab tugas Guided Mode TIDAK memberi XP. Poin/XP HANYA berasal
  // dari menangkap flag (lihat DEFAULT_FLAG_POINTS / LabFlag.points). Dengan
  // begitu, menyelesaikan lab via Guided Mode maupun Free Mode menghasilkan
  // poin yang sama — yang dinilai tetap poin flag.
  DEFAULT_FLAG_POINTS: 50, // poin default per flag (bisa di-override per flag)
  WEEKLY_TARGET_XP: 200, // target XP mingguan (untuk progress bar streak)
  XP_PER_LEVEL,

  // Level dari total XP (server-side, deterministik).
  levelForXp(xp) {
    return Math.floor((xp || 0) / XP_PER_LEVEL) + 1;
  },
  // XP yang sudah terkumpul di dalam level berjalan.
  xpIntoLevel(xp) {
    return (xp || 0) % XP_PER_LEVEL;
  },
};
