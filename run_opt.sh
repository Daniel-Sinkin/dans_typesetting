#!/usr/bin/env bash
# Optimized build: full optimization, assertions off, and no debug information.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_build_common.sh"

build_dir="build-opt"
cmake_extra=(
    -DCMAKE_BUILD_TYPE=Release
    "-DCMAKE_C_FLAGS_RELEASE=-O3 -DNDEBUG"
    "-DCMAKE_CXX_FLAGS_RELEASE=-O3 -DNDEBUG"
)
typesetting_build_sample
