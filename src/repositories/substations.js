const { Substation } = require('../models');
const { createReadRepository } = require('./read-repository');

module.exports = createReadRepository(Substation, 'substation_id');
