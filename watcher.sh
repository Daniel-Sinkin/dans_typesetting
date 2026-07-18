#!/usr/bin/env bash
set -euo pipefail

typesetting_repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${typesetting_repo_root}"

if ! command -v watchexec >/dev/null 2>&1; then
    echo "watcher.sh requires watchexec" >&2
    exit 127
fi

exec watchexec \
    --restart \
    --quiet \
    --clear=reset \
    --postpone \
    --stop-signal SIGTERM \
    --stop-timeout 2s \
    --watch app \
    --watch src \
    --watch CMakeLists.txt \
    --ignore "build/**" \
    --ignore "build-*/**" \
    --ignore "run/**" \
    --ignore "**/*.swp" \
    --ignore "**/*.swo" \
    --ignore "**/*~" \
    --ignore "**/.DS_Store" \
    -- ./dev.sh
