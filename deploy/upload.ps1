# Run from Windows PowerShell. -Bootstrap installs server software on the first run.
[CmdletBinding()]
param([switch]$Bootstrap)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$archive = Join-Path ([IO.Path]::GetTempPath()) "tipsygo-$releaseId.tar.gz"
$remoteArchive = "/root/tipsygo-$releaseId.tar.gz"
$releasePath = "/opt/tipsygo/releases/$releaseId"
$server = 'root@162.0.238.193'
$sshKey = Join-Path $env:USERPROFILE '.ssh\tipsygo_vps_ed25519'

foreach ($tool in @('tar', 'scp', 'ssh')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Required command not found: $tool" }
}
if (-not (Test-Path -LiteralPath $sshKey)) { throw "Dedicated SSH key not found: $sshKey. Run deploy\install-ssh-key.ps1 first." }

try {
    # Explicit source list: do not upload local dependencies, build output or secrets.
    & tar -czf $archive -C $projectRoot src public deploy package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs Dockerfile compose.yaml .dockerignore
    if ($LASTEXITCODE -ne 0) { throw 'Source packaging failed.' }
    & scp -o IdentitiesOnly=yes -i $sshKey $archive "${server}:$remoteArchive"
    if ($LASTEXITCODE -ne 0) { throw 'Upload failed.' }

    $setupCommand = if ($Bootstrap) { 'bash deploy/setup-server.sh' } else { ':' }
    $remoteCommand = @"
set -eu
mkdir -p '$releasePath'
tar -xzf '$remoteArchive' -C '$releasePath'
cd '$releasePath'
sed -i 's/\r$//' deploy/*.sh
$setupCommand
bash deploy/setup-orders.sh
bash deploy/deploy.sh
ln -sfn '$releasePath' /opt/tipsygo/current
rm -f '$remoteArchive'
"@
    # SSH uses a terminal for password prompts; strip CRLF from the Linux command.
    & ssh -o IdentitiesOnly=yes -i $sshKey -t $server ($remoteCommand -replace "`r", '')
    if ($LASTEXITCODE -ne 0) { throw "Server deployment failed. Inspect $releasePath on the VPS; the source archive was retained." }
    Write-Host 'Deployed. HTTP: http://162.0.238.193 | Domain: https://tipsygo.pro (after HTTPS setup)'
} finally {
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive }
}
