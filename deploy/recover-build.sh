#!/usr/bin/env bash
# Usage: bash recover-build.sh /opt/tipsygo/releases/RELEASE_ID
# Adds swap for a memory-starved build and retries an already uploaded release.
set -Eeuo pipefail
trap 'echo "Recovery stopped at line $LINENO. Review the error above; the uploaded source is retained." >&2' ERR
[[ $EUID -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
[[ $# -eq 1 ]] || { echo "Usage: bash recover-build.sh /opt/tipsygo/releases/RELEASE_ID" >&2; exit 1; }
release_path="$(realpath -e -- "$1")"
[[ "$release_path" == /opt/tipsygo/releases/* && -f "$release_path/deploy/deploy.sh" && -f "$release_path/compose.yaml" ]] || {
  echo "Expected an uploaded release inside /opt/tipsygo/releases/." >&2; exit 1;
}
exec 8>/var/lock/tipsygo-recovery.lock
flock -n 8 || { echo "Another recovery is running." >&2; exit 1; }

echo "Memory, swap and disk before recovery:"
free -h
swapon --show
df -h /
echo "Recent kernel messages relating to memory (no matches does not rule out OOM):"
journalctl -k -n 300 --no-pager | grep -Ei 'out of memory|oom-kill|killed process|memory cgroup' || true

swap_file=/swapfile-tipsygo
swap_kib="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)"
# A 4 GiB file provides slightly less than 4 GiB of usable swap.
if (( swap_kib < 4000000 )); then
  if [[ -L "$swap_file" || ( -e "$swap_file" && ! -f "$swap_file" ) ]]; then
    echo "Refusing to use a symlink or non-regular file at $swap_file." >&2; exit 1;
  fi
  if [[ ! -e "$swap_file" ]]; then
    fs_type="$(findmnt -n -o FSTYPE --target /)"
    case "$fs_type" in
      ext2|ext3|ext4|xfs) ;;
      *) echo "Filesystem $fs_type needs a different swap setup; no file was created." >&2; exit 1 ;;
    esac
    available_kib="$(df -Pk / | awk 'NR == 2 {print $4}')"
    if (( available_kib < 6291456 )); then
      echo "Need at least 6 GiB free: 4 GiB for swap plus 2 GiB remaining for the build." >&2
      exit 1
    fi
    echo "Creating 4 GiB of swap at $swap_file; existing swap is preserved."
    umask 077
    (set -o noclobber; : > "$swap_file")
    # dd avoids sparse-file and preallocation incompatibilities with swapon.
    dd if=/dev/zero of="$swap_file" bs=1M count=4096 conv=fsync status=progress
    chmod 600 "$swap_file"
    mkswap "$swap_file"
  elif [[ "$(blkid -p -s TYPE -o value "$swap_file" || true)" != swap ]]; then
    echo "$swap_file already exists but is not a formatted swap file. It was left unchanged." >&2
    exit 1
  fi
  if ! swapon --show=NAME --noheadings --raw | grep -Fxq "$swap_file"; then
    chmod 600 "$swap_file"
    if ! swapon "$swap_file"; then
      echo "The VPS could not enable swap. Check the error above; provider restrictions may apply." >&2
      exit 1
    fi
  fi
else
  echo "At least approximately 4 GiB swap is already enabled; no extra file is needed."
fi

# Persist only our successfully activated swap file, keeping a backup of fstab.
if swapon --show=NAME --noheadings --raw | grep -Fxq "$swap_file"; then
  if ! awk '$1 == "/swapfile-tipsygo" {found=1} END {exit !found}' /etc/fstab; then
    cp -p /etc/fstab "/etc/fstab.tipsygo-backup-$(date +%Y%m%d%H%M%S%N)"
    printf '\n%s none swap sw,nofail 0 0\n' "$swap_file" >> /etc/fstab
    systemctl daemon-reload
  fi
fi

free -h
swapon --show
echo "Retrying $release_path. A build using swap can be slower."
bash "$release_path/deploy/deploy.sh"
ln -sfn "$release_path" /opt/tipsygo/current
echo "Deployment succeeded. Test http://162.0.238.193."
echo "If HTTPS has not been configured, run: bash /opt/tipsygo/current/deploy/enable-https.sh"
