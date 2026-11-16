/**
 * seed-clean-realistic.js (DEPRECATED & NEUTRALIZED)
 * 
 * Previously this script seeded mock operators, managers, agencies, and dummy dossiers.
 * In accordance with the system cleanup, this script now redirects to the clean production
 * purge and seed process to ensure no mock data is ever populated.
 */
const { execSync } = require('child_process');
const path = require('path');

console.log('[Notice] seed-clean-realistic.js has been neutralized. Running clean purge and production seed...');

try {
  execSync('node prisma/purge-mock-data.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  execSync('node prisma/seed.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  console.log('[Success] Database is now clean and production-ready.');
} catch (err) {
  console.error('[Error] Execution failed:', err.message);
  process.exit(1);
}
