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

# Shared ordered JSON utility. Format adapters may use this without depending
# on the canonical document envelope.
add_library(json_support STATIC
  src/transport/json.cpp
  src/transport/json.hpp
)
add_library(dans::json_support ALIAS json_support)
target_include_directories(json_support PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
)
target_link_libraries(json_support PRIVATE typesetter_warnings)

# Stable, versioned interchange boundary shared with the graphical builder.
# It preserves plugin payloads opaquely; plugin modules own materialization.
add_library(canonical_transport STATIC
  src/transport/document_transport.cpp
  src/transport/document_transport.hpp
)
add_library(dans::canonical_transport ALIAS canonical_transport)
target_link_libraries(canonical_transport
  PUBLIC
    dans::document_core
    dans::json_support
  PRIVATE typesetter_warnings
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

add_library(math_matvec_plugin STATIC
  src/plugins/math_matvec.cpp
  src/plugins/math_matvec.hpp
)
add_library(dans::math_matvec_plugin ALIAS math_matvec_plugin)
target_link_libraries(math_matvec_plugin
  PUBLIC dans::math_plugin
  PRIVATE typesetter_warnings
)

add_library(item_list_plugin STATIC
  src/plugins/item_list.cpp
  src/plugins/item_list.hpp
)
add_library(dans::item_list_plugin ALIAS item_list_plugin)
target_link_libraries(item_list_plugin
  PUBLIC dans::core_paragraph
  PRIVATE typesetter_warnings
)

add_library(table_plugin STATIC
  src/plugins/table.cpp
  src/plugins/table.hpp
)
add_library(dans::table_plugin ALIAS table_plugin)
target_link_libraries(table_plugin
  PUBLIC dans::core_paragraph
  PRIVATE typesetter_warnings
)

add_library(table_csv_plugin STATIC
  src/plugins/table_csv.cpp
  src/plugins/table_csv.hpp
)
add_library(dans::table_csv_plugin ALIAS table_csv_plugin)
target_link_libraries(table_csv_plugin
  PUBLIC dans::table_plugin
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

add_library(footnote_plugin STATIC
  src/plugins/footnote.cpp
  src/plugins/footnote.hpp
)
add_library(dans::footnote_plugin ALIAS footnote_plugin)
target_link_libraries(footnote_plugin
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

add_library(excalidraw_drawing_plugin STATIC
  src/plugins/excalidraw_drawing.cpp
  src/plugins/excalidraw_drawing.hpp
)
add_library(dans::excalidraw_drawing_plugin ALIAS excalidraw_drawing_plugin)
target_link_libraries(excalidraw_drawing_plugin
  PUBLIC dans::document_core
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

add_library(inline_code_plugin STATIC
  src/plugins/inline_code.cpp
  src/plugins/inline_code.hpp
)
add_library(dans::inline_code_plugin ALIAS inline_code_plugin)
target_link_libraries(inline_code_plugin
  PUBLIC dans::core_paragraph
  PRIVATE typesetter_warnings
)

add_library(bibliography_plugin STATIC
  src/plugins/bibliography.cpp
  src/plugins/bibliography.hpp
)
add_library(dans::bibliography_plugin ALIAS bibliography_plugin)
target_link_libraries(bibliography_plugin
  PUBLIC dans::core_paragraph
  PRIVATE typesetter_warnings
)

add_library(bibliography_bibtex_plugin STATIC
  src/plugins/bibliography_bibtex.cpp
  src/plugins/bibliography_bibtex.hpp
)
add_library(dans::bibliography_bibtex_plugin ALIAS bibliography_bibtex_plugin)
target_link_libraries(bibliography_bibtex_plugin
  PUBLIC dans::bibliography_plugin
  PRIVATE typesetter_warnings
)

add_library(bibliography_json_plugin STATIC
  src/plugins/bibliography_json.cpp
  src/plugins/bibliography_json.hpp
)
add_library(dans::bibliography_json_plugin ALIAS bibliography_json_plugin)
target_link_libraries(bibliography_json_plugin
  PUBLIC dans::bibliography_plugin
  PRIVATE
    dans::json_support
    typesetter_warnings
)

add_library(document_shell_plugin STATIC
  src/plugins/document_shell.cpp
  src/plugins/document_shell.hpp
)
add_library(dans::document_shell_plugin ALIAS document_shell_plugin)
target_link_libraries(document_shell_plugin
  PUBLIC dans::document_core
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

# Shared TeX expression notation consumed by LaTeX and Markdown math
# connectors. It has no document-container or writer dependency.
add_library(math_tex_expression_connector STATIC
  src/connectors/tex_math_expression.cpp
  src/connectors/tex_math_expression.hpp
)
add_library(dans::math_tex_expression_connector ALIAS math_tex_expression_connector)
target_link_libraries(math_tex_expression_connector
  PUBLIC dans::math_plugin
  PRIVATE typesetter_warnings
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
    dans::math_tex_expression_connector
    typesetter_warnings
)

add_library(item_list_latex_connector STATIC
  src/connectors/latex/item_list.cpp
  src/connectors/latex/item_list.hpp
)
add_library(dans::item_list_latex_connector ALIAS item_list_latex_connector)
target_link_libraries(item_list_latex_connector
  PUBLIC
    dans::item_list_plugin
    dans::core_paragraph_latex_connector
  PRIVATE
    typesetter_warnings
)

add_library(table_latex_connector STATIC
  src/connectors/latex/table.cpp
  src/connectors/latex/table.hpp
)
add_library(dans::table_latex_connector ALIAS table_latex_connector)
target_link_libraries(table_latex_connector
  PUBLIC
    dans::table_plugin
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

add_library(footnote_latex_connector STATIC
  src/connectors/latex/footnote.cpp
  src/connectors/latex/footnote.hpp
)
add_library(dans::footnote_latex_connector ALIAS footnote_latex_connector)
target_link_libraries(footnote_latex_connector
  PUBLIC
    dans::footnote_plugin
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

add_library(excalidraw_drawing_latex_connector STATIC
  src/connectors/latex/excalidraw_drawing.cpp
  src/connectors/latex/excalidraw_drawing.hpp
  src/connectors/latex/graphics.hpp
)
add_library(dans::excalidraw_drawing_latex_connector ALIAS excalidraw_drawing_latex_connector)
target_link_libraries(excalidraw_drawing_latex_connector
  PUBLIC
    dans::excalidraw_drawing_plugin
    dans::latex_writer
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

add_library(inline_code_latex_connector STATIC
  src/connectors/latex/inline_code.cpp
  src/connectors/latex/inline_code.hpp
)
add_library(dans::inline_code_latex_connector ALIAS inline_code_latex_connector)
target_link_libraries(inline_code_latex_connector
  PUBLIC
    dans::inline_code_plugin
    dans::core_paragraph_latex_connector
  PRIVATE
    typesetter_warnings
)

add_library(bibliography_latex_connector STATIC
  src/connectors/latex/bibliography.cpp
  src/connectors/latex/bibliography.hpp
)
add_library(dans::bibliography_latex_connector ALIAS bibliography_latex_connector)
target_link_libraries(bibliography_latex_connector
  PUBLIC
    dans::bibliography_plugin
    dans::core_paragraph_latex_connector
  PRIVATE
    typesetter_warnings
)

add_library(document_shell_latex_connector STATIC
  src/connectors/latex/document_shell.cpp
  src/connectors/latex/document_shell.hpp
)
add_library(dans::document_shell_latex_connector ALIAS document_shell_latex_connector)
target_link_libraries(document_shell_latex_connector
  PUBLIC
    dans::document_shell_plugin
    dans::latex_writer
  PRIVATE
    typesetter_warnings
)

# Opinionated Markdown writer and plugin-specific connector modules. TeX math
# notation is shared with the LaTeX connector because common Markdown math
# extensions consume the same expression language inside $ delimiters.
add_library(markdown_writer STATIC
  src/writers/markdown_writer.cpp
  src/writers/markdown_writer.hpp
)
add_library(dans::markdown_writer ALIAS markdown_writer)
target_link_libraries(markdown_writer
  PUBLIC dans::document_core
  PRIVATE typesetter_warnings
)

add_library(core_paragraph_markdown_connector STATIC
  src/connectors/markdown/core_paragraph.cpp
  src/connectors/markdown/core_paragraph.hpp
)
add_library(dans::core_paragraph_markdown_connector ALIAS core_paragraph_markdown_connector)
target_link_libraries(core_paragraph_markdown_connector
  PUBLIC
    dans::core_paragraph
    dans::markdown_writer
  PRIVATE typesetter_warnings
)

add_library(document_shell_markdown_connector STATIC
  src/connectors/markdown/document_shell.cpp
  src/connectors/markdown/document_shell.hpp
)
add_library(dans::document_shell_markdown_connector ALIAS document_shell_markdown_connector)
target_link_libraries(document_shell_markdown_connector
  PUBLIC
    dans::document_shell_plugin
    dans::markdown_writer
  PRIVATE typesetter_warnings
)

add_library(hyperlink_markdown_connector STATIC
  src/connectors/markdown/hyperlink.cpp
  src/connectors/markdown/hyperlink.hpp
)
add_library(dans::hyperlink_markdown_connector ALIAS hyperlink_markdown_connector)
target_link_libraries(hyperlink_markdown_connector
  PUBLIC
    dans::hyperlink_plugin
    dans::core_paragraph_markdown_connector
  PRIVATE typesetter_warnings
)

add_library(inline_code_markdown_connector STATIC
  src/connectors/markdown/inline_code.cpp
  src/connectors/markdown/inline_code.hpp
)
add_library(dans::inline_code_markdown_connector ALIAS inline_code_markdown_connector)
target_link_libraries(inline_code_markdown_connector
  PUBLIC
    dans::inline_code_plugin
    dans::core_paragraph_markdown_connector
  PRIVATE typesetter_warnings
)

add_library(color_span_markdown_connector STATIC
  src/connectors/markdown/color_span.cpp
  src/connectors/markdown/color_span.hpp
)
add_library(dans::color_span_markdown_connector ALIAS color_span_markdown_connector)
target_link_libraries(color_span_markdown_connector
  PUBLIC
    dans::color_span_plugin
    dans::core_paragraph_markdown_connector
  PRIVATE typesetter_warnings
)

add_library(footnote_markdown_connector STATIC
  src/connectors/markdown/footnote.cpp
  src/connectors/markdown/footnote.hpp
)
add_library(dans::footnote_markdown_connector ALIAS footnote_markdown_connector)
target_link_libraries(footnote_markdown_connector
  PUBLIC
    dans::footnote_plugin
    dans::core_paragraph_markdown_connector
  PRIVATE typesetter_warnings
)

add_library(reference_markdown_connector STATIC
  src/connectors/markdown/reference.cpp
  src/connectors/markdown/reference.hpp
)
add_library(dans::reference_markdown_connector ALIAS reference_markdown_connector)
target_link_libraries(reference_markdown_connector
  PUBLIC
    dans::reference_plugin
    dans::core_paragraph_markdown_connector
  PRIVATE typesetter_warnings
)

add_library(image_markdown_connector STATIC
  src/connectors/markdown/image.cpp
  src/connectors/markdown/image.hpp
)
add_library(dans::image_markdown_connector ALIAS image_markdown_connector)
target_link_libraries(image_markdown_connector
  PUBLIC
    dans::image_plugin
    dans::core_paragraph_markdown_connector
  PRIVATE typesetter_warnings
)

add_library(item_list_markdown_connector STATIC
  src/connectors/markdown/item_list.cpp
  src/connectors/markdown/item_list.hpp
)
add_library(dans::item_list_markdown_connector ALIAS item_list_markdown_connector)
target_link_libraries(item_list_markdown_connector
  PUBLIC
    dans::item_list_plugin
    dans::core_paragraph_markdown_connector
  PRIVATE typesetter_warnings
)

add_library(code_listing_markdown_connector STATIC
  src/connectors/markdown/code_listing.cpp
  src/connectors/markdown/code_listing.hpp
)
add_library(dans::code_listing_markdown_connector ALIAS code_listing_markdown_connector)
target_link_libraries(code_listing_markdown_connector
  PUBLIC
    dans::code_listing_plugin
    dans::core_paragraph_markdown_connector
  PRIVATE typesetter_warnings
)

add_library(table_markdown_connector STATIC
  src/connectors/markdown/table.cpp
  src/connectors/markdown/table.hpp
)
add_library(dans::table_markdown_connector ALIAS table_markdown_connector)
target_link_libraries(table_markdown_connector
  PUBLIC
    dans::table_plugin
    dans::core_paragraph_markdown_connector
  PRIVATE typesetter_warnings
)

add_library(math_markdown_connector STATIC
  src/connectors/markdown/math.cpp
  src/connectors/markdown/math.hpp
)
add_library(dans::math_markdown_connector ALIAS math_markdown_connector)
target_link_libraries(math_markdown_connector
  PUBLIC
    dans::math_plugin
    dans::core_paragraph_markdown_connector
  PRIVATE
    dans::math_tex_expression_connector
    typesetter_warnings
)

add_library(bibliography_markdown_connector STATIC
  src/connectors/markdown/bibliography.cpp
  src/connectors/markdown/bibliography.hpp
)
add_library(dans::bibliography_markdown_connector ALIAS bibliography_markdown_connector)
target_link_libraries(bibliography_markdown_connector
  PUBLIC
    dans::bibliography_plugin
    dans::core_paragraph_markdown_connector
  PRIVATE typesetter_warnings
)

add_executable(document_example
  app/main.cpp
)
target_link_libraries(document_example PRIVATE
  dans::bibliography_latex_connector
  dans::code_listing_latex_connector
  dans::color_span_latex_connector
  dans::core_paragraph_latex_connector
  dans::document_shell_latex_connector
  dans::excalidraw_drawing_latex_connector
  dans::footnote_latex_connector
  dans::image_latex_connector
  dans::inline_code_latex_connector
  dans::item_list_latex_connector
  dans::hyperlink_latex_connector
  dans::latex_mixin_latex_connector
  dans::math_latex_connector
  dans::math_matvec_plugin
  dans::reference_latex_connector
  dans::table_latex_connector
  dans::table_csv_plugin
  typesetter_warnings
)

if(BUILD_TESTING)
  add_executable(native_inline_test
    tests/native_inline_test.cpp
  )
  target_link_libraries(native_inline_test PRIVATE
    dans::core_paragraph_latex_connector
    dans::footnote_latex_connector
    dans::hyperlink_latex_connector
    dans::inline_code_latex_connector
    typesetter_warnings
  )
  add_test(NAME native_inline_test COMMAND native_inline_test)

  add_executable(native_transport_test
    tests/native_transport_test.cpp
  )
  target_compile_definitions(native_transport_test PRIVATE
    DANS_TYPESETTING_CANONICAL_FIXTURE="${CMAKE_CURRENT_SOURCE_DIR}/fixtures/canonical/current-features.dans.json"
    DANS_TYPESETTING_TRANSPORT_TEST_OUTPUT="${CMAKE_CURRENT_BINARY_DIR}/native-transport-roundtrip.dans.json"
  )
  target_link_libraries(native_transport_test PRIVATE
    dans::canonical_transport
    typesetter_warnings
  )
  add_test(NAME native_transport_test COMMAND native_transport_test)

  add_executable(native_document_shell_test
    tests/native_document_shell_test.cpp
  )
  target_link_libraries(native_document_shell_test PRIVATE
    dans::document_shell_latex_connector
    typesetter_warnings
  )
  add_test(NAME native_document_shell_test COMMAND native_document_shell_test)

  add_executable(native_excalidraw_drawing_test
    tests/native_excalidraw_drawing_test.cpp
  )
  target_link_libraries(native_excalidraw_drawing_test PRIVATE
    dans::excalidraw_drawing_latex_connector
    typesetter_warnings
  )
  add_test(NAME native_excalidraw_drawing_test COMMAND native_excalidraw_drawing_test)

  add_executable(native_item_list_test
    tests/native_item_list_test.cpp
  )
  target_link_libraries(native_item_list_test PRIVATE
    dans::item_list_latex_connector
    dans::math_latex_connector
    typesetter_warnings
  )
  add_test(NAME native_item_list_test COMMAND native_item_list_test)

  add_executable(native_table_test
    tests/native_table_test.cpp
  )
  target_link_libraries(native_table_test PRIVATE
    dans::footnote_latex_connector
    dans::math_latex_connector
    dans::table_csv_plugin
    dans::table_latex_connector
    typesetter_warnings
  )
  add_test(NAME native_table_test COMMAND native_table_test)

  add_executable(native_math_matvec_test
    tests/native_math_matvec_test.cpp
  )
  target_link_libraries(native_math_matvec_test PRIVATE
    dans::math_latex_connector
    dans::math_matvec_plugin
    typesetter_warnings
  )
  add_test(NAME native_math_matvec_test COMMAND native_math_matvec_test)

  add_executable(native_math_structures_test
    tests/native_math_structures_test.cpp
  )
  target_link_libraries(native_math_structures_test PRIVATE
    dans::math_latex_connector
    typesetter_warnings
  )
  add_test(NAME native_math_structures_test COMMAND native_math_structures_test)

  add_executable(native_code_listing_test
    tests/native_code_listing_test.cpp
  )
  target_link_libraries(native_code_listing_test PRIVATE
    dans::code_listing_latex_connector
    typesetter_warnings
  )
  add_test(NAME native_code_listing_test COMMAND native_code_listing_test)

  add_executable(native_bibliography_test
    tests/native_bibliography_test.cpp
  )
  target_compile_definitions(native_bibliography_test PRIVATE
    DANS_TYPESETTING_BIBLIOGRAPHY_TEST_OUTPUT="${CMAKE_CURRENT_BINARY_DIR}/native-bibliography-test.json"
  )
  target_link_libraries(native_bibliography_test PRIVATE
    dans::bibliography_bibtex_plugin
    dans::bibliography_json_plugin
    dans::bibliography_latex_connector
    typesetter_warnings
  )
  add_test(NAME native_bibliography_test COMMAND native_bibliography_test)

  add_executable(native_markdown_test
    tests/native_markdown_test.cpp
  )
  target_compile_definitions(native_markdown_test PRIVATE
    DANS_TYPESETTING_MARKDOWN_TEST_OUTPUT="${CMAKE_CURRENT_BINARY_DIR}/native-markdown-test.md"
  )
  target_link_libraries(native_markdown_test PRIVATE
    dans::bibliography_markdown_connector
    dans::code_listing_markdown_connector
    dans::color_span_markdown_connector
    dans::document_shell_markdown_connector
    dans::footnote_markdown_connector
    dans::hyperlink_markdown_connector
    dans::image_markdown_connector
    dans::inline_code_markdown_connector
    dans::item_list_markdown_connector
    dans::math_markdown_connector
    dans::reference_markdown_connector
    dans::table_markdown_connector
    typesetter_warnings
  )
  add_test(NAME native_markdown_test COMMAND native_markdown_test)
endif()

# Build the example object model into LaTeX, then compile the generated source
# with LuaLaTeX.
find_program(TYPESETTING_LATEXMK_EXECUTABLE NAMES latexmk REQUIRED)
find_program(TYPESETTING_LUALATEX_EXECUTABLE NAMES lualatex REQUIRED)
find_program(TYPESETTING_RSVG_CONVERT_EXECUTABLE NAMES rsvg-convert REQUIRED)

set(TYPESETTING_SAMPLE_TEX "${CMAKE_CURRENT_BINARY_DIR}/sample-document.tex")
set(TYPESETTING_SAMPLE_PDF "${CMAKE_CURRENT_BINARY_DIR}/sample-document.pdf")
set(TYPESETTING_SAMPLE_IMAGE_SOURCE "${CMAKE_CURRENT_SOURCE_DIR}/assets/sample-image.tex")
set(TYPESETTING_SAMPLE_IMAGE_PDF "${CMAKE_CURRENT_BINARY_DIR}/sample-image.pdf")
set(TYPESETTING_SAMPLE_EXCALIDRAW_SVG "${CMAKE_CURRENT_SOURCE_DIR}/assets/sample-excalidraw.svg")
set(TYPESETTING_SAMPLE_EXCALIDRAW_PDF "${CMAKE_CURRENT_BINARY_DIR}/sample-excalidraw.pdf")

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
  OUTPUT "${TYPESETTING_SAMPLE_EXCALIDRAW_PDF}"
  COMMAND "${TYPESETTING_RSVG_CONVERT_EXECUTABLE}"
    --format pdf
    --output "${TYPESETTING_SAMPLE_EXCALIDRAW_PDF}"
    "${TYPESETTING_SAMPLE_EXCALIDRAW_SVG}"
  DEPENDS "${TYPESETTING_SAMPLE_EXCALIDRAW_SVG}"
  COMMENT "Rendering the sample Excalidraw scene asset"
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
    "${TYPESETTING_SAMPLE_EXCALIDRAW_PDF}"
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
