#!/usr/bin/env bash
set -euo pipefail
sudo systemctl restart xelity
sudo systemctl --no-pager --full status xelity
