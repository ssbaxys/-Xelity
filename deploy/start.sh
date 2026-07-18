#!/usr/bin/env bash
set -euo pipefail
sudo systemctl start xelity
sudo systemctl --no-pager --full status xelity
