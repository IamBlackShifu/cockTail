#!/usr/bin/env bash
# Run once on the blank Ubuntu VPS, as root.
set -Eeuo pipefail
trap 'echo "Server setup stopped at line $LINENO. Fix the reported error before retrying." >&2' ERR
[[ $EUID -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
source /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 ]] || {
  echo "This script targets Ubuntu 24.04." >&2; exit 1;
}

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl nginx ufw snapd

# Install Docker from its signed official APT repository.
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker nginx
docker compose version

# Allow the port of this SSH session before enabling the firewall.
ssh_port="${SSH_CONNECTION:-}"
ssh_port="${ssh_port##* }"
ssh_port="${ssh_port:-22}"
[[ "$ssh_port" =~ ^[0-9]+$ ]] || { echo "Cannot determine SSH port." >&2; exit 1; }
ufw allow "$ssh_port/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Preserve this file on reruns: Certbot will later add HTTPS to it.
if [[ ! -e /etc/nginx/sites-available/tipsygo ]]; then
  cat > /etc/nginx/sites-available/tipsygo <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name tipsygo.pro 162.0.238.193;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 60s;
    }
}
NGINX
fi
ln -sfn /etc/nginx/sites-available/tipsygo /etc/nginx/sites-enabled/tipsygo
# Disable only Ubuntu's default-site symlink; retain its original configuration.
if [[ -L /etc/nginx/sites-enabled/default && "$(readlink -f /etc/nginx/sites-enabled/default)" == /etc/nginx/sites-available/default ]]; then
  unlink /etc/nginx/sites-enabled/default
fi
nginx -t
systemctl reload nginx
ufw status
echo "Server ready. The app will be reachable once deploy.sh finishes."
if [[ -f /var/run/reboot-required ]]; then
  echo "Ubuntu requests a reboot. Reboot after deployment, then verify the site again."
fi
