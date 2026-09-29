const readings = require('../services/readings');
const { setLastModified } = require('../utils/last-modified');

// 201 with the new reading. Location and Content-Location are relative URIs
// of the reading under its installation; Express adds the strong ETag.
async function createReading(req, res) {
  const reading = await readings.create(req.installation, req.body);
  const uri = `${req.baseUrl}/${reading.reading_id}`;
  res.status(201);
  res.set({ Location: uri, 'Content-Location': uri });
  setLastModified(res, reading.received_at);
  res.json(reading);
}

module.exports = { createReading };
