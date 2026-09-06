const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/db');

async function startServer() {
  try {
    await prisma.$connect();
    app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${env.PORT} (http://localhost:${env.PORT}/api/health)`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
