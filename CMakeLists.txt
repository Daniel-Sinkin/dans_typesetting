cmake_minimum_required(VERSION 3.25)

if(APPLE AND NOT DEFINED CMAKE_C_COMPILER AND NOT DEFINED CMAKE_CXX_COMPILER)
  foreach(TYPESETTING_LLVM_PREFIX IN ITEMS /opt/homebrew/opt/llvm /usr/local/opt/llvm)
    if(EXISTS "${TYPESETTING_LLVM_PREFIX}/bin/clang" AND EXISTS "${TYPESETTING_LLVM_PREFIX}/bin/clang++")
      set(CMAKE_C_COMPILER "${TYPESETTING_LLVM_PREFIX}/bin/clang" CACHE FILEPATH "C compiler" FORCE)
      set(CMAKE_CXX_COMPILER "${TYPESETTING_LLVM_PREFIX}/bin/clang++" CACHE FILEPATH "C++ compiler" FORCE)
      message(STATUS "Using LLVM toolchain from ${TYPESETTING_LLVM_PREFIX}")
      break()
    endif()
  endforeach()
endif()

project(dans_typesetting VERSION 0.1.0 LANGUAGES C CXX)

include(CTest)

if(NOT CMAKE_CONFIGURATION_TYPES AND NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE RelWithDebInfo CACHE STRING "Build type" FORCE)
endif()

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(WIN32)
  add_compile_definitions(_CRT_SECURE_NO_WARNINGS)
endif()

# Strict warnings apply only to first-party targets.
add_library(typesetter_warnings INTERFACE)
target_compile_options(typesetter_warnings INTERFACE
  $<$<CXX_COMPILER_ID:Clang,AppleClang,GNU>:
    -Wall
    -Wextra
    -Wpedantic
    -Werror
    -Wshadow
    -Wconversion
    -Wfloat-conversion
    -Wsign-conversion
    -Wcast-qual
    -Wcast-align
    -Wformat=2
    -Wundef
    -Wnull-dereference
    -Wnon-virtual-dtor
    -Woverloaded-virtual
    -Wold-style-cast
    -Wzero-as-null-pointer-constant
    -Wdouble-promotion
    -Wimplicit-fallthrough
    -Wreturn-type>
  $<$<CXX_COMPILER_ID:Clang,AppleClang>:
    -Wconditional-uninitialized
    -Wextra-semi
    -Wimplicit-int-conversion
    -Wimplicit-int-float-conversion
    -Wnewline-eof
    -Wshorten-64-to-32
    -Wswitch-enum
    -Wunreachable-code>
  $<$<CXX_COMPILER_ID:GNU>:
    -Wduplicated-branches
    -Wduplicated-cond
    -Wlogical-op
    -Wsign-compare
    -Wuseless-cast>
)

# Semantic document core. It owns an ordered tree of type-erased document
# blocks, but has no knowledge of LaTeX, Markdown, PDF, or any other output
# format.
add_library(document_core STATIC
  src/common.hpp
  src/document.cpp
  src/document.hpp
  src/reference_id.cpp
  src/reference_id.hpp
)
add_library(dans::document_core ALIAS document_core)
target_include_directories(document_core PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
)
target_link_libraries(document_core PRIVATE
  typesetter_warnings
)

# First plugin module: ordinary paragraphs.
add_library(core_paragraph STATIC
  src/plugins/core_paragraph.cpp
  src/plugins/core_paragraph.hpp
)
add_library(dans::core_paragraph ALIAS core_paragraph)
target_link_libraries(core_paragraph
  PUBLIC dans::document_core
  PRIVATE typesetter_warnings
)

# Plugin modules extending the Core Paragraph inline contract and document blocks.
add_library(math_plugin STATIC
  src/plugins/math.cpp
  src/plugins/math.hpp
)
add_library(dans::math_plugin ALIAS math_plugin)
target_link_libraries(math_plugin
  PUBLIC dans::core_paragraph
  PRIVATE typesetter_warnings
)

add_library(latex_mixin_plugin STATIC
  src/plugins/latex_mixin.cpp
  src/plugins/latex_mixin.hpp
)
add_library(dans::latex_mixin_plugin ALIAS latex_mixin_plugin)
target_link_libraries(latex_mixin_plugin
  PUBLIC dans::core_paragraph
  PRIVATE typesetter_warnings
)

add_library(color_span_plugin STATIC
  src/plugins/color_span.cpp
  src/plugins/color_span.hpp
)
add_library(dans::color_span_plugin ALIAS color_span_plugin)
target_link_libraries(color_span_plugin
  PUBLIC dans::core_paragraph
  PRIVATE typesetter_warnings
)

add_library(reference_plugin STATIC
  src/plugins/reference.cpp
  src/plugins/reference.hpp
)
add_library(dans::reference_plugin ALIAS reference_plugin)
target_link_libraries(reference_plugin
  PUBLIC dans::core_paragraph
  PRIVATE typesetter_warnings
)

add_library(hyperlink_plugin STATIC
  src/plugins/hyperlink.cpp
  src/plugins/hyperlink.hpp
)
add_library(dans::hyperlink_plugin ALIAS hyperlink_plugin)
target_link_libraries(hyperlink_plugin
  PUBLIC dans::core_paragraph
  PRIVATE typesetter_warnings
)

add_library(image_plugin STATIC
  src/plugins/image.cpp
  src/plugins/image.hpp
)
add_library(dans::image_plugin ALIAS image_plugin)
target_link_libraries(image_plugin
  PUBLIC dans::core_paragraph
  PRIVATE typesetter_warnings
)

add_library(code_listing_plugin STATIC
  src/plugins/code_listing.cpp
  src/plugins/code_listing.hpp
)
add_library(dans::code_listing_plugin ALIAS code_listing_plugin)
target_link_libraries(code_listing_plugin
  PUBLIC dans::core_paragraph
  PRIVATE typesetter_warnings
)

# Opinionated LaTeX document writer and separate connector modules.
add_library(latex_writer STATIC
  src/writers/latex_writer.cpp
  src/writers/latex_writer.hpp
)
add_library(dans::latex_writer ALIAS latex_writer)
target_link_libraries(latex_writer
  PUBLIC dans::document_core
  PRIVATE typesetter_warnings
)

add_library(core_paragraph_latex_connector STATIC
  src/connectors/latex/core_paragraph.cpp
  src/connectors/latex/core_paragraph.hpp
)
add_library(dans::core_paragraph_latex_connector ALIAS core_paragraph_latex_connector)
target_link_libraries(core_paragraph_latex_connector
  PUBLIC
    dans::core_paragraph
    dans::latex_writer
  PRIVATE
    typesetter_warnings
)

add_library(math_latex_connector STATIC
  src/connectors/latex/math.cpp
  src/connectors/latex/math.hpp
)
add_library(dans::math_latex_connector ALIAS math_latex_connector)
target_link_libraries(math_latex_connector
  PUBLIC
    dans::math_plugin
    dans::core_paragraph_latex_connector
  PRIVATE
    typesetter_warnings
)

add_library(latex_mixin_latex_connector STATIC
  src/connectors/latex/latex_mixin.cpp
  src/connectors/latex/latex_mixin.hpp
)
add_library(dans::latex_mixin_latex_connector ALIAS latex_mixin_latex_connector)
target_link_libraries(latex_mixin_latex_connector
  PUBLIC
    dans::latex_mixin_plugin
    dans::core_paragraph_latex_connector
  PRIVATE
    typesetter_warnings
)

add_library(color_span_latex_connector STATIC
  src/connectors/latex/color_span.cpp
  src/connectors/latex/color_span.hpp
)
add_library(dans::color_span_latex_connector ALIAS color_span_latex_connector)
target_link_libraries(color_span_latex_connector
  PUBLIC
    dans::color_span_plugin
    dans::core_paragraph_latex_connector
  PRIVATE
    typesetter_warnings
)

add_library(reference_latex_connector STATIC
  src/connectors/latex/reference.cpp
  src/connectors/latex/reference.hpp
)
add_library(dans::reference_latex_connector ALIAS reference_latex_connector)
target_link_libraries(reference_latex_connector
  PUBLIC
    dans::reference_plugin
    dans::core_paragraph_latex_connector
  PRIVATE
    typesetter_warnings
)

add_library(hyperlink_latex_connector STATIC
  src/connectors/latex/hyperlink.cpp
  src/connectors/latex/hyperlink.hpp
)
add_library(dans::hyperlink_latex_connector ALIAS hyperlink_latex_connector)
target_link_libraries(hyperlink_latex_connector
  PUBLIC
    dans::hyperlink_plugin
    dans::core_paragraph_latex_connector
  PRIVATE
    typesetter_warnings
)

add_library(image_latex_connector STATIC
  src/connectors/latex/image.cpp
  src/connectors/latex/image.hpp
)
add_library(dans::image_latex_connector ALIAS image_latex_connector)
target_link_libraries(image_latex_connector
  PUBLIC
    dans::image_plugin
    dans::core_paragraph_latex_connector
  PRIVATE
    typesetter_warnings
)

add_library(code_listing_latex_connector STATIC
  src/connectors/latex/code_listing.cpp
  src/connectors/latex/code_listing.hpp
)
add_library(dans::code_listing_latex_connector ALIAS code_listing_latex_connector)
target_link_libraries(code_listing_latex_connector
  PUBLIC
    dans::code_listing_plugin
    dans::core_paragraph_latex_connector
  PRIVATE
    typesetter_warnings
)

add_executable(document_example
  app/main.cpp
)
target_link_libraries(document_example PRIVATE
  dans::code_listing_latex_connector
  dans::color_span_latex_connector
  dans::core_paragraph_latex_connector
  dans::image_latex_connector
  dans::hyperlink_latex_connector
  dans::latex_mixin_latex_connector
  dans::math_latex_connector
  dans::reference_latex_connector
  typesetter_warnings
)

if(BUILD_TESTING)
  add_executable(native_inline_test
    tests/native_inline_test.cpp
  )
  target_link_libraries(native_inline_test PRIVATE
    dans::core_paragraph_latex_connector
    dans::hyperlink_latex_connector
    typesetter_warnings
  )
  add_test(NAME native_inline_test COMMAND native_inline_test)
endif()

# Build the example object model into LaTeX, then compile the generated source
# with LuaLaTeX.
find_program(TYPESETTING_LATEXMK_EXECUTABLE NAMES latexmk REQUIRED)
find_program(TYPESETTING_LUALATEX_EXECUTABLE NAMES lualatex REQUIRED)

set(TYPESETTING_SAMPLE_TEX "${CMAKE_CURRENT_BINARY_DIR}/sample-document.tex")
set(TYPESETTING_SAMPLE_PDF "${CMAKE_CURRENT_BINARY_DIR}/sample-document.pdf")
set(TYPESETTING_SAMPLE_IMAGE_SOURCE "${CMAKE_CURRENT_SOURCE_DIR}/assets/sample-image.tex")
set(TYPESETTING_SAMPLE_IMAGE_PDF "${CMAKE_CURRENT_BINARY_DIR}/sample-image.pdf")

add_custom_command(
  OUTPUT "${TYPESETTING_SAMPLE_IMAGE_PDF}"
  COMMAND "${TYPESETTING_LUALATEX_EXECUTABLE}"
    -interaction=nonstopmode
    -halt-on-error
    -file-line-error
    "-jobname=sample-image"
    "-output-directory=${CMAKE_CURRENT_BINARY_DIR}"
    "${TYPESETTING_SAMPLE_IMAGE_SOURCE}"
  DEPENDS "${TYPESETTING_SAMPLE_IMAGE_SOURCE}"
  BYPRODUCTS
    "${CMAKE_CURRENT_BINARY_DIR}/sample-image.aux"
    "${CMAKE_CURRENT_BINARY_DIR}/sample-image.log"
  WORKING_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}"
  COMMENT "Generating the sample image asset"
  VERBATIM
)

add_custom_command(
  OUTPUT "${TYPESETTING_SAMPLE_TEX}"
  COMMAND $<TARGET_FILE:document_example> "${TYPESETTING_SAMPLE_TEX}"
  DEPENDS document_example
  COMMENT "Serializing the sample document model to LaTeX"
  VERBATIM
)

add_custom_command(
  OUTPUT "${TYPESETTING_SAMPLE_PDF}"
  COMMAND "${TYPESETTING_LATEXMK_EXECUTABLE}"
    -lualatex
    -interaction=nonstopmode
    -halt-on-error
    -file-line-error
    "-outdir=${CMAKE_CURRENT_BINARY_DIR}"
    "${TYPESETTING_SAMPLE_TEX}"
  DEPENDS
    "${TYPESETTING_SAMPLE_TEX}"
    "${TYPESETTING_SAMPLE_IMAGE_PDF}"
  BYPRODUCTS
    "${CMAKE_CURRENT_BINARY_DIR}/sample-document.aux"
    "${CMAKE_CURRENT_BINARY_DIR}/sample-document.fdb_latexmk"
    "${CMAKE_CURRENT_BINARY_DIR}/sample-document.fls"
    "${CMAKE_CURRENT_BINARY_DIR}/sample-document.log"
    "${CMAKE_CURRENT_BINARY_DIR}/sample-document.out"
  WORKING_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}"
  COMMENT "Compiling the generated LaTeX document"
  VERBATIM
)

add_custom_target(sample_document ALL DEPENDS "${TYPESETTING_SAMPLE_PDF}")
