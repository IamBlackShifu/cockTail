#!/usr/bin/env bash
# Usage: bash deploy/enable-https.sh [your-email@example.com]
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
[[ -f /etc/nginx/sites-enabled/tipsygo ]] || { echo "Run setup-server.sh first." >&2; exit 1; }
echo "The A record for tipsygo.pro must point to 162.0.238.193."
echo "Port 80 must be reachable from the internet for certificate validation."
nginx -t
systemctl enable --now snapd.socket
snap wait system seed.loaded
if ! snap list certbot >/dev/null 2>&1; then
  snap install --classic certbot
fi
if [[ -n "${1:-}" ]]; then
  /snap/bin/certbot --nginx -d tipsygo.pro --redirect --non-interactive --agree-tos --email "$1"
else
  # Certbot prompts for the certificate contact email and agreement to its terms.
  /snap/bin/certbot --nginx -d tipsygo.pro --redirect
fi
/snap/bin/certbot renew --dry-run
curl --fail --silent --show-error --max-time 30 -o /dev/null https://tipsygo.pro
echo "HTTPS ready: https://tipsygo.pro (automatic certificate renewal enabled by Certbot)."
