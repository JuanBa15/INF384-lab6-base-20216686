// Middleware de manejo de errores: respuesta genérica sin filtrar detalles internos.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
}

module.exports = errorHandler;
