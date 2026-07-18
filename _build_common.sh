#!/usr/bin/env bash
# Shared builder for dev.sh, dbg.sh, and run_opt.sh. Not run directly.

typesetting_repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

typesetting_build_sample() {
    cd "${typesetting_repo_root}"

    case "$(uname -s)" in
        MINGW* | MSYS* | CYGWIN*)
            if [[ -f "${build_dir}/CMakeCache.txt" ]]; then
                cmake -S . -B "${build_dir}" "${cmake_extra[@]}"
            else
                cmake -S . -B "${build_dir}" -G Ninja \
                    -DCMAKE_C_COMPILER="${CC:-clang}" \
                    -DCMAKE_CXX_COMPILER="${CXX:-clang++}" \
                    "${cmake_extra[@]}"
            fi
            ;;
        *)
            cmake -S . -B "${build_dir}" "${cmake_extra[@]}"
            ;;
    esac

    cmake --build "${build_dir}" --target sample_document -j
    echo "Generated ${build_dir}/sample-document.tex and ${build_dir}/sample-document.pdf"
}
