// Protected reads depend on the caller's scope: shared caches must never reuse
// them (private, Vary: Authorization) and a client must revalidate with the
// ETag before reusing its copy (no-cache).
function privateCache(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.set('Cache-Control', 'private, no-cache');
    res.vary('Authorization');
  }
  next();
}

module.exports = privateCache;
