// Hardening headers on every response (errors, 304, /docs and OPTIONS too).
// No Content-Security-Policy: a strict one would break Swagger UI's inline
// scripts and styles at /docs. HSTS only takes effect over HTTPS (Azure).
function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000',
  });
  next();
}

module.exports = securityHeaders;
