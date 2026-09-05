const prisma = require('../config/db');

async function runTransaction(callback) {
  return prisma.$transaction(async (tx) => {
    return callback(tx);
  });
}

module.exports = {
  runTransaction,
};
