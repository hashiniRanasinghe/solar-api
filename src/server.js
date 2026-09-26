const app = require('./app');
const connectDB = require('./config/db');
const { PORT, JWT_SECRET } = require('./config/env');

async function start() {
  if (!JWT_SECRET) {
    console.error('Start-up failed: JWT_SECRET is not set.');
    process.exit(1);
  }
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
