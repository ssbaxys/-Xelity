#!/usr/bin/env bash
# Ставит Docker (если нужно) и поднимает SearXNG для Xelity web_search.
set -euo pipefail

APP_DIR="${XELITY_DIR:-/opt/xelity}"
SEARX_DIR="${APP_DIR}/deploy/searxng"
COMPOSE_FILE="${SEARX_DIR}/docker-compose.yml"
SETTINGS="${SEARX_DIR}/settings.yml"
ENV_FILE="${APP_DIR}/.env"
SEARX_URL="${SEARXNG_URL:-http://127.0.0.1:8888}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти от root: sudo bash deploy/ensure-searxng.sh"
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Нет ${COMPOSE_FILE} — пропуск SearXNG"
  exit 0
fi

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    return 0
  fi
  echo ">> Устанавливаю Docker…"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
}

ensure_secret() {
  if [[ ! -f "${SETTINGS}" ]]; then
    echo "Нет ${SETTINGS}"
    return 1
  fi
  if grep -q 'xelity-change-me-on-install' "${SETTINGS}" 2>/dev/null; then
    local key
    key="$(openssl rand -hex 32)"
    sed -i "s/xelity-change-me-on-install/${key}/" "${SETTINGS}"
    echo ">> SearXNG secret_key сгенерирован"
  fi
}

ensure_env() {
  touch "${ENV_FILE}"
  if grep -qE '^SEARXNG_URL=' "${ENV_FILE}" 2>/dev/null; then
    sed -i "s|^SEARXNG_URL=.*|SEARXNG_URL=${SEARX_URL}|" "${ENV_FILE}"
  else
    printf '\nSEARXNG_URL=%s\n' "${SEARX_URL}" >> "${ENV_FILE}"
    touch /var/lock/xelity-restart-after-searxng
    echo ">> В .env добавлен SEARXNG_URL — нужен рестарт xelity"
  fi
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "${COMPOSE_FILE}" "$@"
  else
    docker-compose -f "${COMPOSE_FILE}" "$@"
  fi
}

ensure_docker
ensure_secret
ensure_env

echo ">> SearXNG: docker compose up -d"
cd "${SEARX_DIR}"
compose pull || true
compose up -d --remove-orphans --force-recreate

# быстрый healthcheck + тест JSON
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -fsS "${SEARX_URL}/" >/dev/null 2>&1; then
    if curl -fsS "${SEARX_URL}/search?q=xelity&format=json" \
      -H 'Accept: application/json' 2>/dev/null | grep -q '"results"'; then
      echo ">> SearXNG готов (JSON): ${SEARX_URL}"
      exit 0
    fi
    echo ">> SearXNG отвечает, ждём JSON… (${i})"
  fi
  sleep 2
done

echo "!! SearXNG ещё не отдаёт JSON. Логи:"
compose ps || true
compose logs --tail=40 || true
echo "Поиск всё равно работает через DuckDuckGo/Wikipedia fallback в API."
