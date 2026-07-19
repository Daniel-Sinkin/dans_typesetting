// Optional bespoke-JSON adapter for normalized bibliography records.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_BIBLIOGRAPHY_JSON_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_BIBLIOGRAPHY_JSON_HPP

#include "plugins/bibliography.hpp"

#include <filesystem>
#include <string>
#include <string_view>
#include <vector>

namespace dans::document::plugins
{
inline constexpr std::string_view k_bibliography_json_format =
    "dans.typesetting.bibliography";
inline constexpr u32 k_bibliography_json_schema_version = 1;

[[nodiscard]] auto parse_bibliography_json(std::string_view source)
    -> std::vector<BibliographyEntry>;
[[nodiscard]] auto serialize_bibliography_json(const Bibliography& bibliography) -> std::string;

// Import is transactional with respect to parsing: the complete source is
// validated before entries are added. The destination must be empty.
auto import_bibliography_json(Bibliography& bibliography, std::string_view source) -> void;
auto import_bibliography_json_file(
    Bibliography& bibliography, const std::filesystem::path& path
) -> void;
auto write_bibliography_json_file(
    const Bibliography& bibliography, const std::filesystem::path& path
) -> void;
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_BIBLIOGRAPHY_JSON_HPP
