const { Province } = require('../models');
const { createReadRepository } = require('./read-repository');

module.exports = createReadRepository(Province, 'province_id');
