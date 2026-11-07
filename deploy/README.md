# Deploy TIPSYGO to Namecheap VPS

Target: Ubuntu 24.04, `root@162.0.238.193`, `https://tipsygo.pro`.

These files prepare deployment; creating them does not change the VPS. Run the commands below yourself. Keep the root password in your SSH prompts, not in scripts.

Checkout now saves real orders in SQLite. The staff dashboard requires a password, receives orders across devices, updates the customer tracker, and manages products and prices without redeployment. Payment is collected on delivery or pickup and marked collected by staff; online payment processing is not integrated. No separate PostgreSQL or Redis service is required for this single-VPS deployment.

## 1. Point the domain to the server

If using Namecheap BasicDNS, PremiumDNS or FreeDNS, open **Domain List > tipsygo.pro > Manage > Advanced DNS > Host Records** and set:

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A Record | @ | 162.0.238.193 | Automatic |

If the domain uses another DNS provider, set this record there. Replace conflicting parking/redirect/A records for `@`. Remove an old `AAAA` record only if it points to a different server; this setup does not assume a VPS IPv6 address. Leave email records intact. This deployment uses `tipsygo.pro`; `www.tipsygo.pro` is not configured.

Check from **Windows PowerShell**:

```powershell
Resolve-DnsName tipsygo.pro -Type A
```

Wait for the new address to resolve before enabling HTTPS. You can upload and deploy while DNS propagates.

## 2. Upload and deploy in one command

Install the dedicated deployment key once. SSH asks for the current VPS password but does not save it:

```powershell
Set-Location 'D:\DELL\Documents\Experiments\cockTail'
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\install-ssh-key.ps1
```

The private key remains at `%USERPROFILE%\.ssh\tipsygo_vps_ed25519`; only its public half is added to the VPS. After verifying key access, change the VPS root password because any password pasted into chat should be treated as exposed. Key-based deployments continue working after that password change.

Run in **Windows PowerShell on your computer**, not in the VPS shell:

```powershell
Set-Location 'D:\DELL\Documents\Experiments\cockTail'
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\upload.ps1 -Bootstrap
```

The execution-policy setting applies only to this PowerShell process. Confirm the SSH host fingerprint against your VPS console on the first connection, then enter the server's root password when prompted. SCP and SSH may each request it. Existing SSH keys also work.

On the first upload with real orders, the script asks you to create and confirm a staff password (12?200 characters). It stores only a salted scrypt hash in `/opt/tipsygo/shared/runtime.env`, alongside `APP_ORIGIN=https://tipsygo.pro`. Keep that file on the VPS. Use the password at `https://tipsygo.pro/ops`. Later uploads keep the existing password. Ordering stays disabled if credentials are missing.

This command bundles the source, uploads it, creates a fresh release under `/opt/tipsygo/releases/`, and runs the shell scripts. It installs Docker Engine, Compose, Nginx, UFW and snapd; allows your current SSH port plus HTTP/HTTPS; builds the app; and starts the container. Docker publishes port 3000 only on loopback and Nginx serves public traffic. The Node process runs as the non-root `node` user inside the container.

The container restarts after a reboot or process crash. Its health check detects an unhealthy HTTP response; Docker does not automatically restart a container merely because it becomes unhealthy. Logs rotate at 10 MB with three files retained. The deployment keeps the old app running during the image build and checks the new container before reporting success. There is a brief interruption while the container is replaced.

Visit `http://162.0.238.193` and `http://tipsygo.pro` after DNS resolves. The first build needs outbound access to Docker Hub, npm, and Google Fonts. If Namecheap has an additional network firewall, allow TCP 80 and 443 there too, along with your SSH port.

## 3. Enable HTTPS

After `tipsygo.pro` resolves to `162.0.238.193` and HTTP works, run from **Windows PowerShell**:

```powershell
ssh -t root@162.0.238.193 "bash /opt/tipsygo/current/deploy/enable-https.sh"
```

Certbot prompts for a contact email and agreement to the certificate terms. The script obtains a certificate for `tipsygo.pro`, redirects domain HTTP traffic to HTTPS, and tests automatic renewal. No paid SSL certificate is required for this flow.

Alternatively, supply your real email to avoid the interactive prompts (this accepts the certificate terms):

```powershell
ssh -t root@162.0.238.193 "bash /opt/tipsygo/current/deploy/enable-https.sh you@example.com"
```

Open **https://tipsygo.pro** and **https://tipsygo.pro/ops**. The certificate covers the domain, not the raw IP address. If certificate validation fails, check DNS, any stale AAAA record, and port 80, then rerun this script.

## Recover a build killed with exit code 137

Exit code 137 means the build received SIGKILL. Memory exhaustion is a common cause; confirm it with kernel messages rather than treating the code alone as proof. The PowerShell exception reports the failed server command, and the SSH connection closes when that command ends.

Upload the recovery script from **Windows PowerShell**:

```powershell
Set-Location 'D:\DELL\Documents\Experiments\cockTail'
scp .\deploy\recover-build.sh root@162.0.238.193:/root/recover-build.sh
```

Retry the release named in your error (replace this path for other failures):

```powershell
ssh -t root@162.0.238.193 "sed -i 's/\r$//' /root/recover-build.sh && bash /root/recover-build.sh /opt/tipsygo/releases/20261104-065150-53a2a128"
```

The script prints RAM, swap, disk space, and recent kernel OOM messages. If less than approximately 4 GiB swap is active, it creates a separate 4 GiB swap file on supported filesystems, requiring at least 6 GiB free disk space beforehand. Existing swap is preserved. It backs up `/etc/fstab` before adding the new swap entry, retries the build using the uploaded source and Docker cache, and updates `/opt/tipsygo/current` only after success. No re-upload or server bootstrap is needed.

Swap uses disk space and is slower than RAM. If the build still exits with 137, retain the new build output and kernel diagnostics: a provider/container memory limit or another SIGKILL source may need investigation. More RAM or building a Linux image on a separate machine are alternatives; swap is not a guaranteed fix.

## Future updates

Run from your local project directory in **Windows PowerShell**:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\upload.ps1
```

This uploads current local files, including uncommitted changes. It excludes local dependencies, `.next`, Git history, and `.env` secrets. It builds in a fresh release directory so deleted source files cannot survive from earlier uploads. It updates `/opt/tipsygo/current` only after deployment succeeds. HTTPS configuration and staff credentials remain in place. Orders live in the `tipsygo_orders` Docker volume, outside release folders and container images. Never delete that volume or run `docker compose down -v` when retaining orders.

Old source releases and build images are retained for inspection. Monitor disk usage and remove specific older releases only once you no longer need them. Do not run overlapping uploads; the server deploy script rejects concurrent builds.

## Server commands

Connect once from Windows:

```powershell
ssh root@162.0.238.193
```

Then run these in the **Ubuntu shell** as needed:

```bash
cd /opt/tipsygo/current

# Status and recent logs
docker compose ps
docker compose logs --tail=100 app
systemctl status nginx --no-pager

# Restart the existing app
docker compose restart app

# Check HTTP, HTTPS, and certificate renewal
curl -I http://127.0.0.1:3000
curl -I https://tipsygo.pro
/snap/bin/certbot renew --dry-run

# Inspect memory and disk space
free -h
df -h
docker system df

# Install Ubuntu updates during a maintenance window
apt-get update && apt-get upgrade -y
test ! -f /var/run/reboot-required || cat /var/run/reboot-required
```

If a reboot is requested, run `reboot`, reconnect, and check the website and `docker compose ps` again. Builds can run out of memory on small VPS plans; check `free -h` and the build output if the process is killed. Increase RAM or add swap before retrying in that case.

If the new container fails its startup health checks, the deployment script attempts to restore the previously running image and exits with an error. This does not roll back database contents. Schema initialization currently only creates missing tables and indexes. Before replacing an existing orders-enabled container, the deploy script makes a consistent SQLite snapshot in `/opt/tipsygo/backups/`.

For a manual rollback after a successful deployment:

```bash
cd /opt/tipsygo/current
docker image inspect tipsygo:previous >/dev/null
docker tag tipsygo:previous tipsygo:local
docker compose up -d --no-build --wait --wait-timeout 120
```

The `previous` tag exists only after updating a running app. This restores its image, not the local source symlink. To inspect the matching source, use the corresponding older directory in `/opt/tipsygo/releases/`.

## Order data, backups and staff access

Orders, products, prices, and staff sessions are saved in the persistent `tipsygo_orders` Docker volume. The container's `ORDER_DB_PATH` is `/app/data/orders.sqlite`. On first startup, the original six menu items seed the empty product table. Later deployments retain staff changes. This is a single-VPS setup; multiple independent replicas need shared database infrastructure.

Make an on-demand backup on the VPS:

```bash
bash /opt/tipsygo/current/deploy/backup-orders.sh
ls -lh /opt/tipsygo/backups
```

The helper uses SQLite's consistent snapshot operation, then copies the snapshot out of the volume. Download selected backups to a separate machine using SCP; a backup on the same VPS does not protect against losing the VPS. These files contain customer details and should remain private. Old snapshots are retained; monitor disk space and keep only the copies you need.

To change the staff password, first back up the existing runtime configuration, move it to a private backup filename, and rerun `deploy/setup-orders.sh`, then `docker compose up -d --force-recreate`. Existing sessions become invalid when the password hash changes. The initial version uses one shared staff password and 12-hour sessions; individual staff accounts and roles are a later upgrade.

Use the HTTPS domain for checkout and staff access. The configured origin rejects cross-site mutations; direct IP checkout is not supported once `APP_ORIGIN=https://tipsygo.pro` is configured. Customers retain a private tracking token in their browser and can track their latest order after refresh. Keep that browser's data to retain tracking access.

Managed product prices, the $4 delivery fee (free from $40), and the 5% service fee are calculated on the server. Removing a product hides it from new orders while historical order snapshots retain their original names and prices. Promotions and online card/mobile-money processing are not enabled. Staff must explicitly mark payment collected; completing an order does not claim it was paid.

## Environment variables

Production credentials are in `/opt/tipsygo/shared/runtime.env`, read by Compose at container startup. The file contains `APP_ORIGIN` and `OPS_PASSWORD_HASH`. The database path is set by Compose. Local development defaults to `http://localhost:3000` and `.data/orders.sqlite`; set a staff hash in `.env.local` to enable local checkout and staff access. Integration tests generate their own temporary credentials and database.

`NEXT_PUBLIC_APP_URL` defaults to `https://tipsygo.pro` and is passed to the Docker build. Public Next.js variables are fixed at build time. The upload helper does not transfer local `.env` files or databases.

## Files

| File | Purpose |
| --- | --- |
| `deploy/upload.ps1` | Windows packaging, upload, and remote command runner |
| `deploy/install-ssh-key.ps1` | One-time public-key installation; never stores the VPS password |
| `deploy/setup-server.sh` | Initial Ubuntu packages, firewall, and Nginx setup |
| `deploy/setup-orders.sh` | One-time staff password setup |
| `deploy/backup-orders.sh` | Consistent order database snapshot |
| `deploy/deploy.sh` | Build, start, health check, and failed-start image recovery |
| `deploy/enable-https.sh` | Certbot certificate and renewal check |
| `deploy/recover-build.sh` | Memory diagnostics, guarded swap creation, and retry of an uploaded release |
| `compose.yaml` | App container, loopback binding, restart policy and health check |
| `Dockerfile` | Node 24 standalone Next.js production image |

References: [Docker on Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Node.js release status](https://nodejs.org/en/about/previous-releases), [Certbot with Nginx](https://certbot.eff.org/instructions?ws=nginx&os=snap), [Namecheap A records](https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-an-a-address-record-for-my-domain/).
