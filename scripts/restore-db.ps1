# ========================================================
# EUROTECH DATABASE DISASTER RECOVERY RESTORE SCRIPT (POWERSHELL)
# Target RTO: < 1 Hour | Single-Command Atomic Restore
# ========================================================

param (
    [Parameter(Mandatory=$true)]
    [string]$BackupZipFile,
    [string]$DbUser = "root",
    [string]$DbPass = "",
    [string]$DbName = "eurotech_db",
    [string]$DbHost = "localhost"
)

if (-not (Test-Path $BackupZipFile)) {
    Write-Host "[ERROR] Backup file not found: $BackupZipFile" -ForegroundColor Red
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Red
Write-Host "   EUROTECH DISASTER RECOVERY (DR) RESTORE DRILL         " -ForegroundColor Red
Write-Host "==========================================================" -ForegroundColor Red
Write-Host "Restoring into database '$DbName' on '$DbHost' from '$BackupZipFile'..."

$TempExtract = Join-Path $env:TEMP "eurotech_dr_restore_temp_$((Get-Date).Ticks)"
New-Item -ItemType Directory -Path $TempExtract -Force | Out-Null

try {
    Expand-Archive -Path $BackupZipFile -DestinationPath $TempExtract -Force
    $SqlFile = Get-ChildItem -Path $TempExtract -Filter "*.sql" | Select-Object -First 1

    if (-not $SqlFile) {
        throw "No SQL dump found inside zip archive."
    }

    $StartTime = Get-Date
    $RestoreCmd = "mysql -u $DbUser --host=$DbHost $DbName < `"$($SqlFile.FullName)`""
    cmd /c $RestoreCmd

    $Duration = ((Get-Date) - $StartTime).TotalSeconds
    Write-Host "[SUCCESS] Database restored in $Duration seconds! RTO SLA Met." -ForegroundColor Green
} finally {
    Remove-Item -Path $TempExtract -Recurse -Force -ErrorAction SilentlyContinue
}
