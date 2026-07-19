// Parse and write CSV without introducing a third-party dependency.
#include "plugins/table_csv.hpp"

#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>

namespace
{
auto append_csv_field(std::string& output, const std::string_view field) -> void
{
    const auto quoted = field.find_first_of(",\"\r\n") != std::string_view::npos;
    if (!quoted)
    {
        output.append(field);
        return;
    }
    output.push_back('"');
    for (const char character : field)
    {
        if (character == '"')
        {
            output.append("\"\"");
        }
        else
        {
            output.push_back(character);
        }
    }
    output.push_back('"');
}

auto validate_rectangular(const dans::document::plugins::TableCsvData& data) -> dans::usize
{
    if (data.rows.empty() || data.rows.front().empty())
    {
        throw std::invalid_argument{"CSV table data requires at least one row and column"};
    }
    const auto column_count = data.rows.front().size();
    for (const auto& row : data.rows)
    {
        if (row.size() != column_count)
        {
            throw std::invalid_argument{"CSV table data must be rectangular"};
        }
    }
    return column_count;
}
}  // namespace

namespace dans::document::plugins
{
auto parse_table_csv(const std::string_view source, const std::optional<usize> maximum_rows)
    -> TableCsvData
{
    TableCsvData result{};
    std::vector<std::string> row{};
    std::string field{};
    auto in_quotes = false;
    auto closed_quote = false;
    auto ended_row = false;

    const auto finish_row = [&]()
    {
        row.push_back(std::move(field));
        field.clear();
        result.rows.push_back(std::move(row));
        row.clear();
        closed_quote = false;
        ended_row = true;
        if (maximum_rows.has_value() && result.rows.size() > *maximum_rows)
        {
            throw std::length_error{"CSV input exceeds the configured row limit"};
        }
    };

    for (usize index{}; index < source.size(); ++index)
    {
        const auto character = source[index];
        if (in_quotes)
        {
            if (character != '"')
            {
                field.push_back(character);
                continue;
            }
            if (index + usize{1} < source.size() && source[index + usize{1}] == '"')
            {
                field.push_back('"');
                ++index;
                continue;
            }
            in_quotes = false;
            closed_quote = true;
            continue;
        }

        if (character == '"')
        {
            if (!field.empty() || closed_quote)
            {
                throw std::invalid_argument{"A quoted CSV field must begin with a quote"};
            }
            in_quotes = true;
            ended_row = false;
        }
        else if (character == ',')
        {
            row.push_back(std::move(field));
            field.clear();
            closed_quote = false;
            ended_row = false;
        }
        else if (character == '\n' || character == '\r')
        {
            finish_row();
            if (character == '\r' && index + usize{1} < source.size()
                && source[index + usize{1}] == '\n')
            {
                ++index;
            }
        }
        else
        {
            if (closed_quote)
            {
                throw std::invalid_argument{"A closed quoted CSV field must end at a delimiter"};
            }
            field.push_back(character);
            ended_row = false;
        }
    }

    if (in_quotes)
    {
        throw std::invalid_argument{"CSV input ends inside a quoted field"};
    }
    if (!source.empty() && !ended_row)
    {
        finish_row();
    }
    validate_rectangular(result);
    return result;
}

auto serialize_table_csv(const TableCsvData& data) -> std::string
{
    validate_rectangular(data);
    std::string output{};
    for (usize row_index{}; row_index < data.rows.size(); ++row_index)
    {
        const auto& row = data.rows[row_index];
        for (usize column_index{}; column_index < row.size(); ++column_index)
        {
            if (column_index != 0)
            {
                output.push_back(',');
            }
            append_csv_field(output, row[column_index]);
        }
        output.push_back('\n');
    }
    return output;
}

auto import_table_csv(
    Table& table, const std::string_view source, const TableCsvImportOptions options
) -> void
{
    if (!table.rows().empty())
    {
        throw std::invalid_argument{"CSV import requires an empty destination table"};
    }
    const auto data = parse_table_csv(source, options.maximum_rows);
    if (validate_rectangular(data) != table.column_count())
    {
        throw std::invalid_argument{"CSV column count does not match the destination table"};
    }
    for (const auto& source_row : data.rows)
    {
        auto& row = table.add_row();
        for (usize column{}; column < source_row.size(); ++column)
        {
            row.cell(column).append_text(source_row[column]);
        }
    }
    table.set_header_rows(options.first_row_is_header ? usize{1} : usize{0});
}

auto import_table_csv_file(
    Table& table, const std::filesystem::path& path, const TableCsvImportOptions options
) -> void
{
    std::ifstream input{path, std::ios::binary};
    if (!input)
    {
        throw std::runtime_error{"Could not open CSV input: " + path.string()};
    }
    std::ostringstream buffer;
    buffer << input.rdbuf();
    if (!input.eof() && input.fail())
    {
        throw std::runtime_error{"Could not read CSV input: " + path.string()};
    }
    import_table_csv(table, buffer.str(), options);
}

auto table_to_csv(const Table& table) -> std::string
{
    TableCsvData data{};
    data.rows.reserve(table.rows().size());
    for (const auto& row : table.rows())
    {
        auto& csv_row = data.rows.emplace_back();
        csv_row.reserve(row->cells().size());
        for (const auto& cell : row->cells())
        {
            std::string text{};
            for (const auto& inline_node : cell->inlines().nodes())
            {
                const auto* core_text = dynamic_cast<const Text*>(inline_node.get());
                if (core_text == nullptr)
                {
                    throw std::invalid_argument{"CSV export supports only plain Text table cells"};
                }
                text.append(core_text->text());
            }
            csv_row.push_back(std::move(text));
        }
    }
    return serialize_table_csv(data);
}

auto write_table_csv_file(const Table& table, const std::filesystem::path& path) -> void
{
    const auto csv = table_to_csv(table);
    std::ofstream output{path, std::ios::binary | std::ios::trunc};
    if (!output)
    {
        throw std::runtime_error{"Could not open CSV output: " + path.string()};
    }
    output << csv;
    output.flush();
    if (!output)
    {
        throw std::runtime_error{"Could not write CSV output: " + path.string()};
    }
}
}  // namespace dans::document::plugins
