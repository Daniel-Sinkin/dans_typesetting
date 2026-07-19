// Optional conservative BibTeX adapter for normalized bibliography records.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_BIBLIOGRAPHY_BIBTEX_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_BIBLIOGRAPHY_BIBTEX_HPP

#include "plugins/bibliography.hpp"

#include <filesystem>
#include <string>
#include <string_view>
#include <vector>

namespace dans::document::plugins
{
[[nodiscard]] auto parse_bibliography_bibtex(std::string_view source)
    -> std::vector<BibliographyEntry>;
[[nodiscard]] auto serialize_bibliography_bibtex(const Bibliography& bibliography) -> std::string;

// This adapter intentionally rejects macros, concatenation, and LaTeX command
// payloads instead of pretending a lossy normalization succeeded.
auto import_bibliography_bibtex(Bibliography& bibliography, std::string_view source) -> void;
auto import_bibliography_bibtex_file(
    Bibliography& bibliography, const std::filesystem::path& path
) -> void;
auto write_bibliography_bibtex_file(
    const Bibliography& bibliography, const std::filesystem::path& path
) -> void;
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_BIBLIOGRAPHY_BIBTEX_HPP
