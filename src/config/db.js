const mongoose = require('mongoose');
const { MONGODB_URI } = require('./env');

async function connectDB() {
  if (!MONGODB_URI) {
    console.error('Database connection failed: MONGODB_URI is not set.');
    process.exit(1);
  }

  try {
    const connection = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`Connected to database: ${connection.connection.name}`);
  } catch (err) {
    console.error(
      'Database connection failed. Check MONGODB_URI, the database user password and Atlas Network Access.'
    );
    process.exit(1);
  }
}

module.exports = connectDB;