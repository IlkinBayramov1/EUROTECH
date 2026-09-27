# ========================================================
# EUROTECH DATABASE AUTOMATED BACKUP SCRIPT (POWERSHELL)
# Target RPO: < 15 Minutes | 30-Day Retention Policy
# ========================================================

param (
    [string]$DbUser = "root",
    [string]$DbPass = "",
    [string]$DbName = "eurotech_db",
    [string]$DbHost = "localhost",
    [string]$BackupDir = "./backups"
)

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupPath = Join-Path $BackupDir "eurotech_db_backup_$Timestamp.sql"
$ZipPath = "$BackupPath.zip"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   EUROTECH AUTOMATED DATABASE BACKUP STARTING...        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Database: $DbName on $DbHost"
Write-Host "Destination: $ZipPath"

# Execute mysqldump
$DumpCommand = "mysqldump -u $DbUser --host=$DbHost --single-transaction --quick --routines --triggers $DbName > `"$BackupPath`""
cmd /c $DumpCommand

if (Test-Path $BackupPath) {
    # Compress with PowerShell
    Compress-Archive -Path $BackupPath -DestinationPath $ZipPath -Force
    Remove-Item $BackupPath -Force

    # Calculate SHA256 Checksum
    $Hash = (Get-FileHash -Path $ZipPath -Algorithm SHA256).Hash
    Write-Host "[SUCCESS] Backup created successfully!" -ForegroundColor Green
    Write-Host "SHA256: $Hash" -ForegroundColor Yellow

    # Log to backup index
    $LogLine = "$Timestamp | $ZipPath | SHA256:$Hash"
    Add-Content -Path (Join-Path $BackupDir "backup_history.log") -Value $LogLine

    # 30-Day Retention Policy: Delete backups older than 30 days
    $Threshold = (Get-Date).AddDays(-30)
    Get-ChildItem -Path $BackupDir -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt $Threshold } | ForEach-Object {
        Write-Host "Purging expired backup: $($_.Name)" -ForegroundColor DarkGray
        Remove-Item $_.FullName -Force
    }
} else {
    Write-Host "[ERROR] mysqldump failed to produce backup file." -ForegroundColor Red
    exit 1
}
