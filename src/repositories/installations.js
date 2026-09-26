const { Installation } = require('../models');
const { createReadRepository } = require('./read-repository');

// The device key hash is never fetched on read paths.
module.exports = createReadRepository(Installation, 'installation_id', '-api_key_hash');
