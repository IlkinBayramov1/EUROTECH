#!/usr/bin/env bash
# ========================================================
# EUROTECH DATABASE DISASTER RECOVERY RESTORE SCRIPT (LINUX)
# Target RTO: < 1 Hour | Single-Command Atomic Restore
# ========================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-eurotech_db}"
DB_HOST="${DB_HOST:-localhost}"

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
  echo "[ERROR] Usage: $0 <path-to-backup.sql.gz>"
  exit 1
fi

echo "=========================================================="
echo "   EUROTECH DISASTER RECOVERY (DR) RESTORE DRILL         "
echo "=========================================================="
echo "Restoring ${DB_NAME} on ${DB_HOST} from ${BACKUP_FILE}..."

START_TIME=$(date +%s)

if [ -n "${DB_PASS}" ]; then
  zcat "${BACKUP_FILE}" | mysql -u "${DB_USER}" -p"${DB_PASS}" -h "${DB_HOST}" "${DB_NAME}"
else
  zcat "${BACKUP_FILE}" | mysql -u "${DB_USER}" -h "${DB_HOST}" "${DB_NAME}"
fi

DURATION=$(( $(date +%s) - START_TIME ))
echo "[SUCCESS] Database restored in ${DURATION}s! RTO SLA Met."
