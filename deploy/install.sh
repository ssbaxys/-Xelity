#!/usr/bin/env bash
# Xelity VPS install — Ubuntu 24.04
#
# Репозиторий приватный — raw.githubusercontent.com даст 404.
# Ставь так (нужен доступ git к GitHub: SSH-ключ или PAT):
#
#   git clone git@github.com:ssbaxys/-Xelity.git /tmp/xelity
#   sudo bash /tmp/xelity/deploy/install.sh
#
# Или с уже склонированной папки:
#   sudo bash deploy/install.sh

set -euo pipefail

APP_DIR="${XELITY_DIR:-/opt/xelity}"
REPO_URL="${XELITY_REPO:-https://github.com/ssbaxys/-Xelity.git}"
BRANCH="${XELITY_BRANCH:-main}"
NODE_MAJOR="${XELITY_NODE:-22}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти от root: sudo bash deploy/install.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git build-essential

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]]; then
  echo ">> Installing Node.js ${NODE_MAJOR}"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

echo ">> Node $(node -v) / npm $(npm -v)"

if [[ -d "${APP_DIR}/.git" ]]; then
  echo ">> Updating ${APP_DIR}"
  git -C "${APP_DIR}" fetch origin
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
else
  echo ">> Cloning into ${APP_DIR}"
  rm -rf "${APP_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"
npm ci
npm run build

if [[ ! -f "${APP_DIR}/.env" ]]; then
  cat > "${APP_DIR}/.env" <<'EOF'
PORT=8088
AITUNNEL_API_KEY=sk-aitunnel-ЗАМЕНИ_НА_СВОЙ_КЛЮЧ
CORS_ORIGIN=https://xelity.ru,https://www.xelity.ru
EOF
  echo ">> Создан ${APP_DIR}/.env — обязательно впиши AITUNNEL_API_KEY"
else
  echo ">> .env уже есть, не трогаю"
fi

id -u www-data >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin www-data
chown -R www-data:www-data "${APP_DIR}"

install -m 644 "${APP_DIR}/deploy/xelity.service" /etc/systemd/system/xelity.service
systemctl daemon-reload
systemctl enable xelity
systemctl restart xelity

sleep 1
systemctl --no-pager --full status xelity || true

echo
echo "============================================"
echo " Xelity установлен"
echo " Каталог:  ${APP_DIR}"
echo " Порт:     смотри PORT в ${APP_DIR}/.env (по умолчанию 8088)"
echo " Статус:   sudo systemctl status xelity"
echo " Стоп:     sudo systemctl stop xelity"
echo " Старт:    sudo systemctl start xelity"
echo " Рестарт:  sudo systemctl restart xelity"
echo " Логи:     sudo journalctl -u xelity -f"
echo " Обновить: sudo bash ${APP_DIR}/deploy/update.sh"
echo "============================================"
echo "Пропиши ключ: sudo nano ${APP_DIR}/.env"
echo "Потом:        sudo systemctl restart xelity"
echo "Открой порт:  sudo ufw allow 8088/tcp   (если ufw включён)"
echo "============================================"
