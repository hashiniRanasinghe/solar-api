const app = require('./app');
const connectDB = require('./config/db');
const { PORT, JWT_SECRET } = require('./config/env');

// HS256 secrets shorter than 32 bytes can be brute-forced from one issued
// token. The value and its length are never printed.
const MIN_SECRET_BYTES = 32;

async function start() {
  if (Buffer.byteLength(JWT_SECRET || '') < MIN_SECRET_BYTES) {
    console.error(
      `Start-up failed: JWT_SECRET must be set and at least ${MIN_SECRET_BYTES} bytes (for example: openssl rand -hex 32).`
    );
    process.exit(1);
  }
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
