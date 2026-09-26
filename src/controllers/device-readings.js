const readings = require('../services/readings');

// 201 with the new reading. Location and Content-Location are relative URIs
// of the reading under its installation; Express adds its default ETag.
async function createReading(req, res) {
  const reading = await readings.create(req.installation, req.body);
  const uri = `${req.baseUrl}/${reading.reading_id}`;
  res.status(201);
  res.set({
    Location: uri,
    'Content-Location': uri,
    'Last-Modified': reading.received_at.toUTCString(),
  });
  res.json(reading);
}

module.exports = { createReading };
