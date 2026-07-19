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

if [[ "${OLD_HEAD}" == "${NEW_HEAD}" ]]; then
  echo "Уже актуально (${OLD_HEAD:0:7}). Нечего обновлять."
  ensure_cli_and_timer
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
echo

if [[ ${need_npm} -eq 1 ]]; then
  echo ">> npm ci"
  npm ci
fi

if [[ ${need_build} -eq 1 ]]; then
  echo ">> npm run build"
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
