#!/usr/bin/env bash
# HTTPS для API: nginx + Let's Encrypt → localhost:8088
# Нужен DNS: api.ТВОЙ_ДОМЕН  A  → IP VPS
#
#   sudo bash /opt/xelity/deploy/setup-https.sh
#   sudo DOMAIN=api.xelity.ru bash /opt/xelity/deploy/setup-https.sh
#
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Нужен root: sudo bash deploy/setup-https.sh"
  exit 1
fi

APP_DIR="${XELITY_DIR:-/opt/xelity}"
ENV_FILE="${APP_DIR}/.env"
DOMAIN="${DOMAIN:-api.xelity.ru}"
EMAIL="${CERT_EMAIL:-admin@xelity.ru}"
PORT="$(grep -E '^PORT=' "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- || true)"
PORT="${PORT:-8088}"

ask() {
  local prompt="$1" def="${2:-}"
  local __out=""
  if [[ -r /dev/tty ]]; then
    read -r -p "${prompt}" __out </dev/tty || true
  elif [[ -t 0 ]]; then
    read -r -p "${prompt}" __out || true
  fi
  if [[ -z "${__out}" && -n "${def}" ]]; then
    __out="${def}"
  fi
  printf '%s' "${__out}"
}

echo
echo "══════════════════════════════════════"
echo "  HTTPS для Xelity API"
echo "══════════════════════════════════════"
echo "Сначала в DNS у регистратора:"
echo "  ${DOMAIN}  →  A  →  IP этого VPS"
echo

DOMAIN=$(ask "Домен API [${DOMAIN}]: " "${DOMAIN}")
EMAIL=$(ask "Email для Let's Encrypt [${EMAIL}]: " "${EMAIL}")

echo
echo ">> Проверка DNS…"
RESOLVED=$(getent ahostsv4 "${DOMAIN}" 2>/dev/null | awk '{print $1; exit}' || true)
MYIP=$(curl -4 -fsS --max-time 5 ifconfig.me 2>/dev/null || curl -4 -fsS --max-time 5 icanhazip.com 2>/dev/null || true)
echo "  ${DOMAIN} → ${RESOLVED:-???}"
echo "  VPS IP    → ${MYIP:-???}"
if [[ -n "${RESOLVED}" && -n "${MYIP}" && "${RESOLVED}" != "${MYIP}" ]]; then
  echo "Внимание: DNS ещё не указывает на этот VPS. Подожди распространения или поправь A-запись."
  yn=$(ask "Всё равно продолжить? [y/N] ")
  [[ "${yn}" =~ ^[Yy]$ ]] || exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

cat > "/etc/nginx/sites-available/xelity-api" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        client_max_body_size 1m;
    }
}
EOF

ln -sfn /etc/nginx/sites-available/xelity-api /etc/nginx/sites-enabled/xelity-api
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

# открыть 80/443
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi 'Status: active'; then
  ufw allow 'Nginx Full' || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
fi

echo ">> Получаю сертификат…"
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect

# CORS: добавим https фронт если нет
if [[ -f "${ENV_FILE}" ]]; then
  cors=$(grep -E '^CORS_ORIGIN=' "${ENV_FILE}" | head -1 | cut -d= -f2- || true)
  need="https://xelity.ru,https://www.xelity.ru,https://${DOMAIN}"
  if [[ -z "${cors}" || "${cors}" == "*" ]]; then
    sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${need}|" "${ENV_FILE}" 2>/dev/null || echo "CORS_ORIGIN=${need}" >> "${ENV_FILE}"
  fi
  systemctl restart xelity || true
fi

echo
echo "══════════════════════════════════════"
echo "  HTTPS готов: https://${DOMAIN}"
echo "══════════════════════════════════════"
echo "На Render поставь:"
echo "  VITE_API_BASE_URL=https://${DOMAIN}"
echo "и сделай Manual Deploy."
echo
curl -fsS "https://${DOMAIN}/" >/dev/null && echo "Проверка https://${DOMAIN}/ — OK" || echo "Проверка не прошла — подожди DNS/сертификат"
