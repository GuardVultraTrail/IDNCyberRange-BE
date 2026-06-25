// ===========================================================================
// ApiError — error operasional dengan status HTTP, dipakai untuk menolak
// request secara terkontrol (mis. 401 Unauthorized, 403 Forbidden, 404).
// ===========================================================================
class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code; // kode mesin opsional, mis. 'BOLA_BLOCKED'
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static unauthorized(msg = 'Tidak terautentikasi.') {
    return new ApiError(401, msg, 'UNAUTHORIZED');
  }
  static forbidden(msg = 'Akses ditolak.') {
    return new ApiError(403, msg, 'FORBIDDEN');
  }
  static notFound(msg = 'Sumber daya tidak ditemukan.') {
    return new ApiError(404, msg, 'NOT_FOUND');
  }
  static badRequest(msg = 'Permintaan tidak valid.') {
    return new ApiError(400, msg, 'BAD_REQUEST');
  }
  static conflict(msg = 'Konflik data.') {
    return new ApiError(409, msg, 'CONFLICT');
  }
}

module.exports = ApiError;
