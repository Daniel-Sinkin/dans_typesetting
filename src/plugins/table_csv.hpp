// Optional RFC-4180-style CSV adapter for the semantic table plugin.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_TABLE_CSV_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_TABLE_CSV_HPP

#include "plugins/table.hpp"

#include <filesystem>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace dans::document::plugins
{
struct TableCsvImportOptions
{
    bool first_row_is_header{};
    std::optional<usize> maximum_rows{};
};

struct TableCsvData
{
    std::vector<std::vector<std::string>> rows{};
};

[[nodiscard]] auto
parse_table_csv(std::string_view source, std::optional<usize> maximum_rows = std::nullopt)
    -> TableCsvData;
[[nodiscard]] auto serialize_table_csv(const TableCsvData& data) -> std::string;

// Import replaces no existing data: the destination must be an empty table
// with the same number of columns as the CSV document.
auto import_table_csv(Table& table, std::string_view source, TableCsvImportOptions options = {})
    -> void;
auto import_table_csv_file(
    Table& table, const std::filesystem::path& path, TableCsvImportOptions options = {}
) -> void;

// CSV is a plain-text projection. Text leaves are concatenated; exporting
// any other inline extension is rejected instead of silently losing meaning.
[[nodiscard]] auto table_to_csv(const Table& table) -> std::string;
auto write_table_csv_file(const Table& table, const std::filesystem::path& path) -> void;
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_TABLE_CSV_HPP
