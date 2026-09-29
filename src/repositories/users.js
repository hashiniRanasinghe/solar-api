const { User } = require('../models');

// Used by login only. The result includes password_hash for the bcrypt
// compare; it is never sent (the model's toJSON removes it).
async function findByUsername(username) {
  return User.findOne({ username });
}

module.exports = { findByUsername };
