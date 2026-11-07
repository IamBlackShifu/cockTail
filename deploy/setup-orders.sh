#!/usr/bin/env bash
# Run before the first deployment with real orders. Password never enters shell history.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
config=/opt/tipsygo/shared/runtime.env
if [[ -f "$config" ]]; then
  if grep -Eq '^OPS_PASSWORD_HASH=[a-f0-9]{32}:[a-f0-9]{128}$' "$config" && grep -q '^APP_ORIGIN=https://tipsygo.pro$' "$config"; then
    echo "Existing staff login configuration retained."
    exit 0
  fi
  echo "$config exists but is incomplete. Review it; this script will not overwrite it." >&2
  exit 1
fi
install -d -m 0700 /opt/tipsygo/shared
echo "Create the password staff will use at https://tipsygo.pro/ops."
read -r -s -p 'Staff password (12-200 characters): ' staff_password
printf '\n'
read -r -s -p 'Confirm staff password: ' staff_confirmation
printf '\n'
[[ ${#staff_password} -ge 12 && ${#staff_password} -le 200 && "$staff_password" == "$staff_confirmation" ]] || {
  echo "Passwords must match and contain 12-200 characters. Run the upload again." >&2; exit 1;
}
password_hash="$(printf '%s' "$staff_password" | docker run --rm -i node:24-bookworm-slim node -e '
  const crypto = require("node:crypto");
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const salt = crypto.randomBytes(16).toString("hex");
    process.stdout.write(salt + ":" + crypto.scryptSync(input, salt, 64).toString("hex"));
  });
')"
unset staff_password staff_confirmation
[[ "$password_hash" =~ ^[a-f0-9]{32}:[a-f0-9]{128}$ ]] || { echo "Password hashing failed." >&2; exit 1; }
umask 077
(set -o noclobber; printf 'APP_ORIGIN=https://tipsygo.pro\nOPS_PASSWORD_HASH=%s\n' "$password_hash" > "$config")
unset password_hash
echo "Staff login configured. Orders will be stored in the persistent tipsygo_orders Docker volume."
