// ===========================================================================
// MIDDLEWARE: validate
// ---------------------------------------------------------------------------
// Validasi & sanitasi input memakai skema Zod sebelum data masuk ke controller.
// Manfaat keamanan: menutup input tak terduga (mass assignment, tipe salah,
// payload berlebih) sejak di gerbang, sehingga controller hanya menerima data
// yang sudah berbentuk benar.
// ===========================================================================
const ApiError = require('../utils/ApiError');

function validate(schema) {
  return function (req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.errors[0];
      const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Input tidak valid.';
      return next(ApiError.badRequest(msg));
    }
    // Ganti body dengan hasil parse (hanya field yang dideklarasikan di skema
    // yang lolos -> mencegah field liar/berbahaya menumpang masuk).
    req.body = result.data;
    next();
  };
}

module.exports = validate;
