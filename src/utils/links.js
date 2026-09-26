// Builds relative next/previous links that keep every other query parameter.
function pageLinks(req, { offset, limit, count }) {
  const [path, queryString = ''] = req.originalUrl.split('?');

  function link(newOffset) {
    const params = new URLSearchParams(queryString);
    params.set('offset', String(newOffset));
    params.set('limit', String(limit));
    return `${path}?${params.toString()}`;
  }

  return {
    next: offset + limit < count ? link(offset + limit) : null,
    previous: offset > 0 ? link(Math.max(0, offset - limit)) : null,
  };
}

module.exports = { pageLinks };
