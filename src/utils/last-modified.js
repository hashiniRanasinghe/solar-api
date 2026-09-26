// Sets Last-Modified to the latest of the given dates. Missing dates are
// skipped; with none left, no header is sent.
function setLastModified(res, ...dates) {
  const times = dates.filter(Boolean).map((date) => new Date(date).getTime());
  if (times.length > 0) {
    res.set('Last-Modified', new Date(Math.max(...times)).toUTCString());
  }
}

module.exports = { setLastModified };
