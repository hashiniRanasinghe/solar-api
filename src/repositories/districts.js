const { District } = require('../models');
const { createReadRepository } = require('./read-repository');

module.exports = createReadRepository(District, 'district_id');
