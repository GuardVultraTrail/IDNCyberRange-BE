// ===========================================================================
// Pembungkus async — meneruskan error dari handler async ke errorHandler
// terpusat tanpa perlu try/catch berulang di tiap controller.
// ===========================================================================
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
