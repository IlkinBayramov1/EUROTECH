const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/db');
const { bootstrapSystemData } = require('./core/bootstrap.service');
const { ensureSampleFiles } = require('./scripts/ensure-sample-files');

async function startServer() {
  try {
    await prisma.$connect();
    await ensureSampleFiles();
    await bootstrapSystemData(prisma);
    const { startScheduler } = require('./cron/scheduler');
    startScheduler();
    app.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT} (http://localhost:${env.PORT}/api/health)`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
