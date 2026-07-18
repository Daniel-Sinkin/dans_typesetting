#!/usr/bin/env bash
# Fast edit/run build: no optimization and lightweight debug information.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_build_common.sh"

build_dir="build"
cmake_extra=(
    -DCMAKE_BUILD_TYPE=Debug
    "-DCMAKE_C_FLAGS_DEBUG=-O0 -g1"
    "-DCMAKE_CXX_FLAGS_DEBUG=-O0 -g1"
)
typesetting_build_sample
