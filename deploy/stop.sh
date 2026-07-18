#!/usr/bin/env bash
set -euo pipefail
sudo systemctl stop xelity
echo "Xelity остановлен."
sudo systemctl is-active xelity || true
