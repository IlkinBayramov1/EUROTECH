#!/usr/bin/env bash
# ========================================================
# EUROTECH DATABASE AUTOMATED BACKUP SCRIPT (LINUX/BASH)
# Target RPO: < 15 Minutes | 30-Day Retention Policy
# ========================================================

set -euo pipefail

DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-eurotech_db}"
DB_HOST="${DB_HOST:-localhost}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/eurotech_db_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "=========================================================="
echo "   EUROTECH AUTOMATED DATABASE BACKUP STARTING...        "
echo "=========================================================="
echo "Database: ${DB_NAME} on ${DB_HOST}"
echo "Destination: ${BACKUP_FILE}"

if [ -n "${DB_PASS}" ]; then
  MYSQLDUMP_CMD="mysqldump -u ${DB_USER} -p${DB_PASS} -h ${DB_HOST} --single-transaction --quick ${DB_NAME}"
else
  MYSQLDUMP_CMD="mysqldump -u ${DB_USER} -h ${DB_HOST} --single-transaction --quick ${DB_NAME}"
fi

${MYSQLDUMP_CMD} | gzip -9 > "${BACKUP_FILE}"

# SHA256 Checksum
CHECKSUM=$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')
echo "[SUCCESS] Backup complete. SHA256: ${CHECKSUM}"
echo "${TIMESTAMP} | ${BACKUP_FILE} | SHA256:${CHECKSUM}" >> "${BACKUP_DIR}/backup_history.log"

# 30-Day Retention Policy: Purge files older than 30 days
find "${BACKUP_DIR}" -name "*.sql.gz" -type f -mtime +30 -delete
echo "[SUCCESS] Retention policy executed (files > 30 days purged)."
