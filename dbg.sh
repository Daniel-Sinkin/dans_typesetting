#!/usr/bin/env bash
# Full debug build: no optimization and complete debugger information.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_build_common.sh"

build_dir="build-dbg"
cmake_extra=(
    -DCMAKE_BUILD_TYPE=Debug
    "-DCMAKE_C_FLAGS_DEBUG=-O0 -g"
    "-DCMAKE_CXX_FLAGS_DEBUG=-O0 -g"
)
typesetting_build_sample
