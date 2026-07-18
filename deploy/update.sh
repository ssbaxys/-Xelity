#!/usr/bin/env bash
# Обновить Xelity на VPS из GitHub
set -euo pipefail

APP_DIR="${XELITY_DIR:-/opt/xelity}"
BRANCH="${XELITY_BRANCH:-main}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти: sudo bash deploy/update.sh"
  exit 1
fi

cd "${APP_DIR}"
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"
npm ci
npm run build
install -m 755 "${APP_DIR}/deploy/ai-tool" /usr/local/bin/ai-tool
install -m 644 "${APP_DIR}/deploy/xelity.service" /etc/systemd/system/xelity.service
systemctl daemon-reload
chown -R www-data:www-data "${APP_DIR}"
# не затираем .env
systemctl restart xelity
systemctl --no-pager --full status xelity || true
echo "Обновлено. Меню: sudo ai-tool"
