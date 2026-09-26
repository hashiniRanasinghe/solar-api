const { AppError } = require('../utils/errors');

// Write requests must declare a JSON body (415 otherwise). Parameters such as
// charset are allowed; the media type itself must be application/json.
function requireJson(req, res, next) {
  const header = req.get('Content-Type') || '';
  const mediaType = header.split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    throw AppError.unsupportedMediaType();
  }
  next();
}

module.exports = requireJson;
