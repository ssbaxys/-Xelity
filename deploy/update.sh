#!/usr/bin/env bash
# Умное обновление Xelity: качает git, дальше npm/build/restart
# только если изменились нужные файлы.
set -euo pipefail

APP_DIR="${XELITY_DIR:-/opt/xelity}"
BRANCH="${XELITY_BRANCH:-main}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти: sudo bash deploy/update.sh"
  exit 1
fi

# не запускать параллельно (таймер + ручной ai-tool update)
exec 9>/var/lock/xelity-update.lock
if ! flock -n 9; then
  echo "Уже идёт обновление — пропуск."
  exit 0
fi

git config --global --add safe.directory "${APP_DIR}"
cd "${APP_DIR}"
chown -R root:root "${APP_DIR}/.git" 2>/dev/null || true

echo ">> Fetch ${BRANCH}…"
git -c safe.directory="${APP_DIR}" fetch origin "${BRANCH}"

OLD_HEAD="$(git -c safe.directory="${APP_DIR}" rev-parse HEAD)"
NEW_HEAD="$(git -c safe.directory="${APP_DIR}" rev-parse "origin/${BRANCH}")"

ensure_cli_and_timer() {
  if [[ -f "${APP_DIR}/deploy/ai-tool" ]]; then
    install -m 755 "${APP_DIR}/deploy/ai-tool" /usr/local/bin/ai-tool
  fi
  if [[ -f "${APP_DIR}/deploy/xelity-autoupdate.service" && -f "${APP_DIR}/deploy/xelity-autoupdate.timer" ]]; then
    install -m 644 "${APP_DIR}/deploy/xelity-autoupdate.service" /etc/systemd/system/xelity-autoupdate.service
    install -m 644 "${APP_DIR}/deploy/xelity-autoupdate.timer" /etc/systemd/system/xelity-autoupdate.timer
    systemctl daemon-reload
    if [[ ! -f /etc/xelity-autoupdate.disabled ]]; then
      if ! systemctl is-enabled --quiet xelity-autoupdate.timer 2>/dev/null; then
        systemctl enable --now xelity-autoupdate.timer
        echo ">> autoupdate timer включён (каждые 2 мин)"
      fi
    fi
  fi
}

ensure_searxng() {
  if [[ -f "${APP_DIR}/deploy/ensure-searxng.sh" ]]; then
    echo ">> SearXNG"
    bash "${APP_DIR}/deploy/ensure-searxng.sh" || echo "!! SearXNG: не удалось поднять (web_search может не работать)"
  fi
}

if [[ "${OLD_HEAD}" == "${NEW_HEAD}" ]]; then
  echo "Уже актуально (${OLD_HEAD:0:7}). Нечего обновлять."
  ensure_cli_and_timer
  ensure_searxng
  if [[ -f /var/lock/xelity-restart-after-searxng ]]; then
    rm -f /var/lock/xelity-restart-after-searxng
    echo ">> systemctl restart xelity (новый SEARXNG_URL)"
    systemctl restart xelity || true
  fi
  exit 0
fi

echo ">> ${OLD_HEAD:0:7} → ${NEW_HEAD:0:7}"
CHANGED="$(git -c safe.directory="${APP_DIR}" diff --name-only "${OLD_HEAD}" "${NEW_HEAD}" || true)"
echo "Изменилось файлов: $(printf '%s\n' "${CHANGED}" | grep -c . || true)"
printf '%s\n' "${CHANGED}" | sed 's/^/  - /' | head -n 40
COUNT="$(printf '%s\n' "${CHANGED}" | grep -c . || true)"
if [[ "${COUNT}" -gt 40 ]]; then
  echo "  … и ещё $((COUNT - 40))"
fi

git -c safe.directory="${APP_DIR}" checkout "${BRANCH}"
git -c safe.directory="${APP_DIR}" pull --ff-only origin "${BRANCH}"

need_npm=0
need_build=0
need_restart=0
need_cli=0
need_unit=0

path_match() {
  # $1 = regex for grep -E
  printf '%s\n' "${CHANGED}" | grep -Eq "$1"
}

if path_match '^(package\.json|package-lock\.json)$'; then
  need_npm=1
  need_build=1
  need_restart=1
fi

if path_match '^(src/|public/|index\.html|vite\.config\.ts|vite\.aitunnel-plugin\.ts|tsconfig\.json)'; then
  need_build=1
fi

if path_match '^(server\.ts|server/|src/lib/models\.ts|src/lib/plans\.ts|package\.json|package-lock\.json)'; then
  need_restart=1
fi

if path_match '^deploy/ai-tool$'; then
  need_cli=1
fi

if path_match '^deploy/(xelity\.service|xelity-autoupdate\.(service|timer))$'; then
  need_unit=1
fi

need_searxng=0
if path_match '^deploy/(searxng/|ensure-searxng\.sh)'; then
  need_searxng=1
fi

# если dist нет — обязательно собрать
if [[ ! -f "${APP_DIR}/dist/index.html" ]]; then
  need_build=1
fi

# если node_modules битые/нет — npm ci
if [[ ! -d "${APP_DIR}/node_modules" ]] || [[ ! -x "${APP_DIR}/node_modules/.bin/tsx" ]]; then
  need_npm=1
  need_restart=1
fi

echo
echo "План:"
echo "  npm ci:     $([[ ${need_npm} -eq 1 ]] && echo да || echo пропуск)"
echo "  build:      $([[ ${need_build} -eq 1 ]] && echo да || echo пропуск)"
echo "  ai-tool:    $([[ ${need_cli} -eq 1 ]] && echo да || echo пропуск)"
echo "  systemd:    $([[ ${need_unit} -eq 1 ]] && echo да || echo пропуск)"
echo "  restart:    $([[ ${need_restart} -eq 1 ]] && echo да || echo пропуск)"
echo "  searxng:    да (проверить/поднять)"
echo

# Vite/npm на маленьких VPS легко ловят heap OOM — поднимаем лимит и swap.
ensure_build_memory() {
  local avail_kb
  avail_kb="$(awk '/MemAvailable/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  # ~1.5GB heap по умолчанию; на очень тесных машинах — 768
  if [[ "${avail_kb}" -gt 0 && "${avail_kb}" -lt 900000 ]]; then
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}"
  else
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
  fi
  echo ">> NODE_OPTIONS=${NODE_OPTIONS} (MemAvailable≈${avail_kb} kB)"

  if [[ "${avail_kb}" -gt 0 && "${avail_kb}" -lt 700000 ]]; then
    if ! swapon --show 2>/dev/null | grep -q .; then
      if [[ ! -f /swapfile ]]; then
        echo ">> мало RAM — создаём swap 2G"
        fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
        chmod 600 /swapfile
        mkswap /swapfile >/dev/null
      fi
      swapon /swapfile 2>/dev/null || true
    fi
  fi
}

if [[ ${need_npm} -eq 1 ]]; then
  echo ">> npm ci"
  ensure_build_memory
  npm ci
fi

if [[ ${need_build} -eq 1 ]]; then
  echo ">> npm run build"
  ensure_build_memory
  # без singlefile — иначе OOM на VPS
  unset XELITY_SINGLEFILE || true
  npm run build
fi

if [[ ${need_cli} -eq 1 || ! -x /usr/local/bin/ai-tool ]]; then
  echo ">> install ai-tool"
  install -m 755 "${APP_DIR}/deploy/ai-tool" /usr/local/bin/ai-tool
fi

if [[ ${need_unit} -eq 1 ]]; then
  echo ">> systemd units"
  install -m 644 "${APP_DIR}/deploy/xelity.service" /etc/systemd/system/xelity.service
  need_restart=1
fi

# всегда синхронизируем таймер автообновления
ensure_cli_and_timer
if systemctl is-enabled --quiet xelity-autoupdate.timer 2>/dev/null; then
  systemctl restart xelity-autoupdate.timer || true
fi

# SearXNG — всегда следим, чтобы web_search работал после обновлений
ensure_searxng
if [[ ${need_searxng} -eq 1 || -f /var/lock/xelity-restart-after-searxng ]]; then
  need_restart=1
  rm -f /var/lock/xelity-restart-after-searxng
fi

chown -R www-data:www-data "${APP_DIR}"

if [[ ${need_restart} -eq 1 ]]; then
  echo ">> systemctl restart xelity"
  systemctl restart xelity
else
  echo ">> рестарт не нужен (бэкенд не менялся)"
fi

systemctl --no-pager --full status xelity || true
echo
echo "Готово ${NEW_HEAD:0:7}. Меню: sudo ai-tool"
