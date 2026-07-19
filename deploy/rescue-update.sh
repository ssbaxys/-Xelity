#!/usr/bin/env bash
# Аварийное обновление, если ai-tool «залип» на старом коммите.
# curl -fsSL https://raw.githubusercontent.com/ssbaxys/-Xelity/main/deploy/rescue-update.sh | sudo bash
set -euo pipefail

APP_DIR="${XELITY_DIR:-/opt/xelity}"
BRANCH="${XELITY_BRANCH:-main}"
REPO_URL="${XELITY_REPO:-https://github.com/ssbaxys/-Xelity.git}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Нужен root: curl … | sudo bash"
  exit 1
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "Нет ${APP_DIR}/.git — полный install: bash deploy/install.sh"
  exit 1
fi

git config --global --add safe.directory "${APP_DIR}"
chown -R root:root "${APP_DIR}/.git" 2>/dev/null || true
cd "${APP_DIR}"

echo ">> remote: $(git remote get-url origin 2>/dev/null || echo '?')"
git remote set-url origin "${REPO_URL}" 2>/dev/null || true
git fetch origin "${BRANCH}" --prune --force
echo ">> было:  $(git rev-parse --short HEAD)"
echo ">> GitHub: $(git rev-parse --short "origin/${BRANCH}")"
git checkout -B "${BRANCH}" "origin/${BRANCH}"
git reset --hard "origin/${BRANCH}"
git clean -fd -e .env -e 'deploy/searxng/.env' -e node_modules -e dist -e data || true
echo ">> стало: $(git rev-parse --short HEAD)"

install -m 755 "${APP_DIR}/deploy/ai-tool" /usr/local/bin/ai-tool
bash "${APP_DIR}/deploy/update.sh"
