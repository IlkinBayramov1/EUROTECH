const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/db');

async function startServer() {
  try {
    // Verify DB connection via Prisma
    await prisma.$connect();
    console.log('Successfully connected to MySQL database via Prisma ORM.');

    app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(` EUROTECH Enterprise Visa & Immigration Platform`);
      console.log(` Server is listening on port: ${env.PORT}`);
      console.log(` Environment: ${env.NODE_ENV}`);
      console.log(` Health Check: http://127.0.0.1:${env.PORT}/api/health`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
