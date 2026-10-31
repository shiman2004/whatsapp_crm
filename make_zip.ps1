$baseDir = 'd:\whatsapp_crm-main'
$zipPath = 'd:\whatsapp_crm-main\crm_latest_updates.zip'
$tempDir = Join-Path $env:TEMP ('crm_update_' + [guid]::NewGuid().ToString())

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$files = Get-ChildItem -Path $baseDir -Recurse -File | Where-Object {
    $_.FullName -notmatch '\\(node_modules|\.git|dist|build|uploads|scratch)\\' -and
    $_.LastWriteTime -ge [datetime]'2026-10-27 16:00:00' -and
    $_.Name -notmatch '\.(zip|log|tmp)$'
}

Write-Host "Found $($files.Count) files modified since Oct 27 16:00..."

New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

foreach ($f in $files) {
    $relPath = $f.FullName.Substring($baseDir.Length).TrimStart('\', '/')
    $destFile = Join-Path $tempDir $relPath
    $destFolder = Split-Path $destFile -Parent
    if (!(Test-Path $destFolder)) {
        New-Item -ItemType Directory -Path $destFolder -Force | Out-Null
    }
    Copy-Item $f.FullName -Destination $destFile -Force
}

Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $zipPath -Force
Remove-Item -Recurse -Force $tempDir

$zipItem = Get-Item $zipPath
Write-Host "ZIP Created Successfully!"
Write-Host "File: $($zipItem.FullName)"
Write-Host "Size: $([math]::Round($zipItem.Length / 1KB, 2)) KB"
