#!/usr/bin/env bash
# Xelity VPS install — Ubuntu 24.04
# Спросит только API-ключ (или передай его в переменной).
#
# Надёжный способ (рекомендуется):
#   curl -fsSL https://raw.githubusercontent.com/ssbaxys/-Xelity/main/deploy/install.sh -o /tmp/xelity-install.sh
#   sudo bash /tmp/xelity-install.sh
#
# Без вопросов (ключ сразу):
#   sudo AITUNNEL_API_KEY='sk-aitunnel-xxx' bash /tmp/xelity-install.sh
#
set -euo pipefail

APP_DIR="${XELITY_DIR:-/opt/xelity}"
REPO_URL="${XELITY_REPO:-https://github.com/ssbaxys/-Xelity.git}"
BRANCH="${XELITY_BRANCH:-main}"
NODE_MAJOR="${XELITY_NODE:-22}"
DEFAULT_PORT="${XELITY_PORT:-8088}"
DEFAULT_CORS="${XELITY_CORS:-https://xelity.ru,https://www.xelity.ru}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти от root: sudo bash /tmp/xelity-install.sh"
  exit 1
fi

# Не даём SSH/pipe оборвать длинный apt/npm
trap '' HUP
export DEBIAN_FRONTEND=noninteractive

echo
echo "══════════════════════════════════════"
echo "  Xelity — установка бэкенда на VPS"
echo "══════════════════════════════════════"
echo

ask() {
  local prompt="$1"
  local __out=""
  # 1) настоящий терминал  2) stdin если не pipe-скрипт
  if [[ -r /dev/tty ]]; then
    read -r -p "${prompt}" __out </dev/tty || true
  elif [[ -t 0 ]]; then
    read -r -p "${prompt}" __out || true
  else
    echo "(нет tty — задай ключ так: sudo AITUNNEL_API_KEY='sk-…' bash \$0)" >&2
  fi
  printf '%s' "${__out}"
}

# --- ask only for API key ---
API_KEY="${AITUNNEL_API_KEY:-}"
if [[ -z "${API_KEY}" ]]; then
  if [[ -f "${APP_DIR}/.env" ]] && grep -qE '^AITUNNEL_API_KEY=sk-' "${APP_DIR}/.env" 2>/dev/null; then
    echo "Найден существующий ключ в ${APP_DIR}/.env"
    keep=$(ask "Оставить его? [Y/n] ")
    keep=${keep:-Y}
    if [[ ! "${keep}" =~ ^[Nn]$ ]]; then
      API_KEY=$(grep -E '^AITUNNEL_API_KEY=' "${APP_DIR}/.env" | head -1 | cut -d= -f2-)
    fi
  fi
fi

if [[ -z "${API_KEY}" ]]; then
  echo "Вставь ключ AITUNNEL (из https://aitunnel.ru → Ключи)"
  echo "Можно вставить и нажать Enter. Если SSH рвётся — см. команду без вопросов ниже."
  API_KEY=$(ask "API key: ")
  API_KEY=$(echo "${API_KEY}" | tr -d '[:space:]')
fi

if [[ -z "${API_KEY}" ]]; then
  echo
  echo "Ошибка: ключ не получен (часто из-за curl|bash и обрыва SSH)."
  echo "Сделай так:"
  echo "  curl -fsSL https://raw.githubusercontent.com/ssbaxys/-Xelity/main/deploy/install.sh -o /tmp/xelity-install.sh"
  echo "  sudo AITUNNEL_API_KEY='sk-aitunnel-ТВОЙ_КЛЮЧ' bash /tmp/xelity-install.sh"
  exit 1
fi

if [[ "${API_KEY}" != sk-aitunnel-* ]]; then
  echo "Предупреждение: ключ обычно начинается с sk-aitunnel-"
  yn=$(ask "Продолжить? [y/N] ")
  [[ "${yn}" =~ ^[Yy]$ ]] || exit 1
fi

echo
echo ">> Ставлю зависимости…"
apt-get update -y
apt-get install -y ca-certificates curl git build-essential

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]]; then
  echo ">> Node.js ${NODE_MAJOR}"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

echo ">> Node $(node -v)"

if [[ -d "${APP_DIR}/.git" ]]; then
  echo ">> Обновляю ${APP_DIR}"
  git -C "${APP_DIR}" fetch origin
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
else
  echo ">> Клонирую в ${APP_DIR}"
  rm -rf "${APP_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"
npm ci
npm run build

# preserve PORT/CORS if existed
PORT_VAL="${DEFAULT_PORT}"
CORS_VAL="${DEFAULT_CORS}"
if [[ -f "${APP_DIR}/.env" ]]; then
  old_port=$(grep -E '^PORT=' "${APP_DIR}/.env" | head -1 | cut -d= -f2- || true)
  old_cors=$(grep -E '^CORS_ORIGIN=' "${APP_DIR}/.env" | head -1 | cut -d= -f2- || true)
  [[ -n "${old_port}" ]] && PORT_VAL="${old_port}"
  [[ -n "${old_cors}" ]] && CORS_VAL="${old_cors}"
fi

umask 077
cat > "${APP_DIR}/.env" <<EOF
PORT=${PORT_VAL}
AITUNNEL_API_KEY=${API_KEY}
CORS_ORIGIN=${CORS_VAL}
EOF
chmod 600 "${APP_DIR}/.env"

id -u www-data >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin www-data
chown -R www-data:www-data "${APP_DIR}"

install -m 644 "${APP_DIR}/deploy/xelity.service" /etc/systemd/system/xelity.service
install -m 755 "${APP_DIR}/deploy/ai-tool" /usr/local/bin/ai-tool

# firewall if ufw active
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi 'Status: active'; then
  ufw allow "${PORT_VAL}/tcp" comment 'xelity' || true
fi

systemctl daemon-reload
systemctl enable xelity
systemctl restart xelity
sleep 1

echo
echo "══════════════════════════════════════"
echo "  Готово"
echo "══════════════════════════════════════"
systemctl --no-pager --full status xelity || true
echo
echo " Меню настроек:  sudo ai-tool"
echo " Статус:         sudo ai-tool status"
echo " Порт API:       ${PORT_VAL}"
echo " Render env:     VITE_API_BASE_URL=http://IP_VPS:${PORT_VAL}"
echo "══════════════════════════════════════"
