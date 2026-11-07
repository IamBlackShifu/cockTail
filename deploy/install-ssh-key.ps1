# Installs only the public deployment key. SSH prompts for the VPS password once.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$sshKey = Join-Path $env:USERPROFILE '.ssh\tipsygo_vps_ed25519'
$publicKey = "$sshKey.pub"
$server = 'root@162.0.238.193'

foreach ($tool in @('ssh', 'ssh-keygen')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Required command not found: $tool" }
}
if (-not (Test-Path -LiteralPath $sshKey) -or -not (Test-Path -LiteralPath $publicKey)) {
    throw "Dedicated key is missing. Expected $sshKey and $publicKey."
}

$fingerprint = & ssh-keygen -lf $publicKey
if ($LASTEXITCODE -ne 0) { throw 'Could not read the public key fingerprint.' }
Write-Host "Installing public key: $fingerprint"
Write-Host 'Enter the current VPS root password when SSH prompts. It is not saved.'

# The public key is safe to stream. Avoid remote shell variables here because
# Windows OpenSSH command-line quoting can strip them before the POSIX shell runs.
Get-Content -LiteralPath $publicKey -Raw | & ssh `
    -o IdentitiesOnly=yes `
    -o PreferredAuthentications=publickey,password `
    -o StrictHostKeyChecking=accept-new `
    -i $sshKey `
    $server `
    'set -eu; umask 077; mkdir -p /root/.ssh; cat >> /root/.ssh/authorized_keys; chmod 700 /root/.ssh; chmod 600 /root/.ssh/authorized_keys'
if ($LASTEXITCODE -ne 0) { throw 'The public key was not installed.' }

& ssh -o BatchMode=yes -o IdentitiesOnly=yes -i $sshKey $server 'printf "SSH key ready.\n"'
if ($LASTEXITCODE -ne 0) { throw 'The key was copied, but key-only verification failed.' }
Write-Host 'Key-based access is ready. Future deployments do not need the VPS password.'
