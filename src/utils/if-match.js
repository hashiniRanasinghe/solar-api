const { AppError } = require('./errors');

// The strong ETag a GET would send for this representation: the app's own
// ETag function over the same JSON that res.json writes (the app sets no json
// replacer or spaces).
function etagOf(req, representation) {
  return req.app.get('etag fn')(JSON.stringify(representation), 'utf8');
}

// Optional If-Match (WP section 10.5). Returns false when the header is
// absent, true when it matches, and throws 412 otherwise. * matches any
// existing representation. The comparison is strong, so a weak tag (W/...)
// never matches.
function checkIfMatch(req, representation) {
  const header = req.get('If-Match');
  if (header === undefined) return false;
  if (header.trim() === '*') return true;
  const current = etagOf(req, representation);
  if (!header.split(',').some((tag) => tag.trim() === current)) {
    throw AppError.preconditionFailed();
  }
  return true;
}

module.exports = { etagOf, checkIfMatch };
