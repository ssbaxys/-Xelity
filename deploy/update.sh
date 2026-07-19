#!/usr/bin/env bash
# Быстрое обновление Xelity: git → точечный npm/build/restart.
# Тяжёлые шаги (SearXNG pull, chown node_modules) — только когда нужно.
set -euo pipefail

APP_DIR="${XELITY_DIR:-/opt/xelity}"
BRANCH="${XELITY_BRANCH:-main}"
# ai-tool может выставить после своего fetch
SKIP_FETCH="${XELITY_SKIP_FETCH:-0}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти: sudo bash deploy/update.sh"
  exit 1
fi

# не запускать параллельно (таймер + ручной ai-tool update)
exec 9>/var/lock/xelity-update.lock
if ! flock -n 9; then
  echo "Уже идёт обновление — жду до 10 мин…"
  if ! flock -w 600 9; then
    echo "!! Не дождался lock — выходи и повтори: sudo ai-tool update"
    exit 1
  fi
fi

git config --global --add safe.directory "${APP_DIR}" 2>/dev/null || true
cd "${APP_DIR}"
chown -R root:root "${APP_DIR}/.git" 2>/dev/null || true

GIT=(git -c safe.directory="${APP_DIR}")

if [[ "${SKIP_FETCH}" != "1" ]]; then
  echo ">> Fetch ${BRANCH}…"
  # один запрос вместо ls-remote + fetch
  "${GIT[@]}" fetch origin "${BRANCH}" --prune --force --quiet
else
  echo ">> Fetch пропущен (уже сделан)"
fi

OLD_HEAD="$("${GIT[@]}" rev-parse HEAD)"
NEW_HEAD="$("${GIT[@]}" rev-parse "origin/${BRANCH}" 2>/dev/null || echo "")"
if [[ -z "${NEW_HEAD}" ]]; then
  echo "!! Не удалось узнать origin/${BRANCH}. Проверь сеть / git remote."
  exit 1
fi

ensure_cli_and_timer() {
  if [[ -f "${APP_DIR}/deploy/ai-tool" ]]; then
    install -m 755 "${APP_DIR}/deploy/ai-tool" /usr/local/bin/ai-tool
  fi
  if [[ -f "${APP_DIR}/deploy/xelity-autoupdate.service" && -f "${APP_DIR}/deploy/xelity-autoupdate.timer" ]]; then
    local unit_changed=0
    if ! cmp -s "${APP_DIR}/deploy/xelity-autoupdate.service" /etc/systemd/system/xelity-autoupdate.service 2>/dev/null \
      || ! cmp -s "${APP_DIR}/deploy/xelity-autoupdate.timer" /etc/systemd/system/xelity-autoupdate.timer 2>/dev/null; then
      install -m 644 "${APP_DIR}/deploy/xelity-autoupdate.service" /etc/systemd/system/xelity-autoupdate.service
      install -m 644 "${APP_DIR}/deploy/xelity-autoupdate.timer" /etc/systemd/system/xelity-autoupdate.timer
      unit_changed=1
    fi
    if [[ "${unit_changed}" -eq 1 ]]; then
      systemctl daemon-reload
    fi
    if [[ -f /etc/xelity-autoupdate.disabled ]]; then
      systemctl disable --now xelity-autoupdate.timer 2>/dev/null || true
    else
      systemctl enable xelity-autoupdate.timer >/dev/null 2>&1 || true
      if ! systemctl is-active --quiet xelity-autoupdate.timer 2>/dev/null; then
        systemctl start xelity-autoupdate.timer 2>/dev/null || true
      fi
    fi
  fi
}

# Лёгкая проверка SearXNG (без docker pull)
ensure_searxng_quick() {
  if [[ -f "${APP_DIR}/deploy/ensure-searxng.sh" ]]; then
    bash "${APP_DIR}/deploy/ensure-searxng.sh" || echo "!! SearXNG: пропуск/ошибка"
  fi
}

ensure_searxng_force() {
  if [[ -f "${APP_DIR}/deploy/ensure-searxng.sh" ]]; then
    echo ">> SearXNG (force — изменились файлы)"
    bash "${APP_DIR}/deploy/ensure-searxng.sh" --force || echo "!! SearXNG: не удалось"
  fi
}

# www-data нужен доступ к коду; полный chown -R node_modules — минуты
fix_app_ownership() {
  local paths=(
    server.ts
    server
    src
    dist
    data
    package.json
    package-lock.json
    tsconfig.json
    vite.config.ts
    vite.aitunnel-plugin.ts
    index.html
    public
  )
  for p in "${paths[@]}"; do
    if [[ -e "${APP_DIR}/${p}" ]]; then
      chown -R www-data:www-data "${APP_DIR}/${p}" 2>/dev/null || true
    fi
  done
  if [[ -d "${APP_DIR}/node_modules" ]]; then
    chown www-data:www-data "${APP_DIR}/node_modules" 2>/dev/null || true
    if [[ -d "${APP_DIR}/node_modules/.bin" ]]; then
      chown -R www-data:www-data "${APP_DIR}/node_modules/.bin" 2>/dev/null || true
    fi
    # полный chmod только если www-data ещё не читает tsx (иначе минуты зря)
    if ! sudo -u www-data test -r "${APP_DIR}/node_modules/tsx/package.json" 2>/dev/null; then
      echo ">> chmod node_modules для www-data (один раз)"
      chmod -R a+rX "${APP_DIR}/node_modules" 2>/dev/null || true
    fi
  fi
  chown -R root:root "${APP_DIR}/.git" 2>/dev/null || true
  if [[ -f "${APP_DIR}/.env" ]]; then
    chown www-data:www-data "${APP_DIR}/.env"
    chmod 640 "${APP_DIR}/.env"
  fi
}

if [[ "${OLD_HEAD}" == "${NEW_HEAD}" ]]; then
  echo "Уже актуально (${OLD_HEAD:0:7}). Нечего обновлять."
  ensure_cli_and_timer
  ensure_searxng_quick
  if [[ -f /var/lock/xelity-restart-after-searxng ]]; then
    rm -f /var/lock/xelity-restart-after-searxng
    echo ">> systemctl restart xelity (новый SEARXNG_URL)"
    systemctl restart xelity || true
  fi
  exit 0
fi

echo ">> ${OLD_HEAD:0:7} → ${NEW_HEAD:0:7}"
CHANGED="$("${GIT[@]}" diff --name-only "${OLD_HEAD}" "${NEW_HEAD}" || true)"
COUNT="$(printf '%s\n' "${CHANGED}" | grep -c . || true)"
echo "Изменилось файлов: ${COUNT}"
printf '%s\n' "${CHANGED}" | sed 's/^/  - /' | head -n 25
if [[ "${COUNT}" -gt 25 ]]; then
  echo "  … и ещё $((COUNT - 25))"
fi

echo ">> git reset --hard origin/${BRANCH}"
"${GIT[@]}" checkout -B "${BRANCH}" "origin/${BRANCH}" --quiet
"${GIT[@]}" reset --hard "origin/${BRANCH}" --quiet
"${GIT[@]}" clean -fd \
  -e .env \
  -e 'deploy/searxng/.env' \
  -e node_modules \
  -e dist \
  -e data \
  >/dev/null 2>&1 || true

HEAD_NOW="$("${GIT[@]}" rev-parse HEAD)"
if [[ "${HEAD_NOW}" != "${NEW_HEAD}" ]]; then
  echo "!! HEAD ${HEAD_NOW:0:7} ≠ ожидаемый ${NEW_HEAD:0:7}"
  exit 1
fi
echo ">> код: ${HEAD_NOW:0:7}"

need_npm=0
need_build=0
need_restart=0
need_cli=0
need_unit=0
need_searxng=0
need_chmod_modules=0

path_match() {
  printf '%s\n' "${CHANGED}" | grep -Eq "$1"
}

if path_match '^(package\.json|package-lock\.json)$'; then
  need_npm=1
  need_build=1
  need_restart=1
  need_chmod_modules=1
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

if path_match '^deploy/(searxng/|ensure-searxng\.sh)'; then
  need_searxng=1
fi

if [[ ! -f "${APP_DIR}/dist/index.html" ]]; then
  need_build=1
fi

if [[ ! -d "${APP_DIR}/node_modules" ]] || [[ ! -x "${APP_DIR}/node_modules/.bin/tsx" ]]; then
  need_npm=1
  need_restart=1
  need_chmod_modules=1
fi

echo
echo "План:"
echo "  npm ci:     $([[ ${need_npm} -eq 1 ]] && echo да || echo пропуск)"
echo "  build:      $([[ ${need_build} -eq 1 ]] && echo да || echo пропуск)"
echo "  ai-tool:    $([[ ${need_cli} -eq 1 ]] && echo да || echo пропуск)"
echo "  systemd:    $([[ ${need_unit} -eq 1 ]] && echo да || echo пропуск)"
echo "  restart:    $([[ ${need_restart} -eq 1 ]] && echo да || echo пропуск)"
echo "  searxng:    $([[ ${need_searxng} -eq 1 ]] && echo force || echo quick)"
echo

ensure_build_memory() {
  local avail_kb
  avail_kb="$(awk '/MemAvailable/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  if [[ "${avail_kb}" -gt 0 && "${avail_kb}" -lt 900000 ]]; then
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}"
  else
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
  fi
  echo ">> NODE_OPTIONS=${NODE_OPTIONS}"

  if [[ "${avail_kb}" -gt 0 && "${avail_kb}" -lt 700000 ]]; then
    if ! swapon --show 2>/dev/null | grep -q .; then
      if [[ ! -f /swapfile ]]; then
        echo ">> мало RAM — swap 2G"
        fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
        chmod 600 /swapfile
        mkswap /swapfile >/dev/null
      fi
      swapon /swapfile 2>/dev/null || true
    fi
  fi
}

if [[ ${need_npm} -eq 1 ]]; then
  echo ">> npm ci (offline cache)"
  ensure_build_memory
  npm ci --prefer-offline --no-audit --no-fund --loglevel=error
fi

if [[ ${need_build} -eq 1 ]]; then
  echo ">> npm run build"
  ensure_build_memory
  unset XELITY_SINGLEFILE || true
  npm run build
fi

echo ">> install ai-tool"
install -m 755 "${APP_DIR}/deploy/ai-tool" /usr/local/bin/ai-tool

if [[ ${need_unit} -eq 1 ]]; then
  echo ">> systemd units"
  install -m 644 "${APP_DIR}/deploy/xelity.service" /etc/systemd/system/xelity.service
  systemctl daemon-reload
  need_restart=1
fi

ensure_cli_and_timer

if [[ ${need_searxng} -eq 1 ]]; then
  ensure_searxng_force
else
  ensure_searxng_quick
fi
if [[ -f /var/lock/xelity-restart-after-searxng ]]; then
  need_restart=1
  rm -f /var/lock/xelity-restart-after-searxng
fi

echo ">> права www-data (точечно)"
fix_app_ownership
if [[ ${need_chmod_modules} -eq 1 && -d "${APP_DIR}/node_modules" ]]; then
  echo ">> chmod node_modules после npm ci"
  chmod -R a+rX "${APP_DIR}/node_modules" 2>/dev/null || true
fi

if [[ ${need_restart} -eq 1 ]]; then
  echo ">> systemctl restart xelity"
  systemctl restart xelity
else
  echo ">> рестарт не нужен (бэкенд не менялся)"
fi

echo
echo "Готово $("${GIT[@]}" rev-parse --short HEAD). Меню: sudo ai-tool"
systemctl is-active xelity >/dev/null 2>&1 && echo "Сервис: active" || systemctl --no-pager --full status xelity | head -n 12 || true
