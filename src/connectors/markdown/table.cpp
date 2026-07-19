// src/connectors/markdown/table.cpp — lower rectangular inline-rich cells to GFM tables.
#include "connectors/markdown/table.hpp"

#include <stdexcept>
#include <string>
#include <utility>

namespace dans::document::connectors::markdown
{
namespace
{
auto make_table_cell(const std::string& rendered) -> std::string
{
    std::string cell{};
    cell.reserve(rendered.size());
    usize preceding_backslashes{};
    for (const char character : rendered)
    {
        if (character == '\n' || character == '\r')
        {
            if (character == '\n')
            {
                cell += "<br>";
            }
            preceding_backslashes = 0;
            continue;
        }
        if (character == '|' && preceding_backslashes % usize{2} == usize{0})
        {
            cell += '\\';
        }
        cell += character;
        if (character == '\\')
        {
            ++preceding_backslashes;
        }
        else
        {
            preceding_backslashes = 0;
        }
    }
    return cell;
}

auto alignment_marker(const plugins::TableColumnAlignment alignment) -> std::string_view
{
    switch (alignment)
    {
        case plugins::TableColumnAlignment::left:
            return ":---";
        case plugins::TableColumnAlignment::center:
            return ":---:";
        case plugins::TableColumnAlignment::right:
            return "---:";
    }
    throw std::logic_error{"Unknown table-column alignment"};
}
}  // namespace

TableMarkdownAdapter::TableMarkdownAdapter(
    std::shared_ptr<const InlineMarkdownRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A table Markdown adapter requires an inline renderer"};
    }
}

auto TableMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Table::k_type_id;
}

auto TableMarkdownAdapter::targets(const DocumentBlock& block) const
    -> std::vector<writers::MarkdownTargetDescriptor>
{
    const auto* table = dynamic_cast<const plugins::Table*>(&block);
    if (table == nullptr)
    {
        throw std::invalid_argument{"The table adapter received a different block type"};
    }
    return {{
        .reference_id = table->reference_id().has_value() ? &*table->reference_id() : nullptr,
        .label = "Table",
        .numbering_series = "table",
    }};
}

auto TableMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* table = dynamic_cast<const plugins::Table*>(&block);
    if (table == nullptr)
    {
        throw std::invalid_argument{"The table adapter received a different block type"};
    }
    if (table->rows().empty())
    {
        throw std::invalid_argument{"A rendered table requires at least one row"};
    }
    if (table->caption().nodes().empty())
    {
        throw std::invalid_argument{"A rendered table requires caption content"};
    }
    if (table->header_rows() > usize{1})
    {
        throw std::invalid_argument{"GFM Markdown tables support zero or one semantic header row"};
    }
    if (table->reference_id().has_value())
    {
        output.write_anchor(*table->reference_id());
        output.write_raw("\n");
    }

    const auto write_row = [&](const plugins::TableRow& row)
    {
        output.write_raw("| ");
        for (usize column{}; column < table->column_count(); ++column)
        {
            if (column != usize{0})
            {
                output.write_raw(" | ");
            }
            output.write_raw(
                make_table_cell(inline_renderer_->render(row.cell(column).inlines(), output))
            );
        }
        output.write_raw(" |\n");
    };

    if (table->header_rows() == usize{1})
    {
        write_row(*table->rows().front());
    }
    else
    {
        output.write_raw("| ");
        for (usize column{}; column < table->column_count(); ++column)
        {
            if (column != usize{0})
            {
                output.write_raw(" | ");
            }
            output.write_raw(" ");
        }
        output.write_raw(" |\n");
    }
    output.write_raw("|");
    for (usize column{}; column < table->column_count(); ++column)
    {
        output.write_raw(" ");
        output.write_raw(alignment_marker(table->column_alignment(column)));
        output.write_raw(" |");
    }
    output.write_raw("\n");
    const usize first_body_row = table->header_rows();
    for (usize row = first_body_row; row < table->rows().size(); ++row)
    {
        write_row(*table->rows()[row]);
    }

    output.write_raw("\n*Table ");
    output.write_raw(output.target_number(block));
    output.write_raw(": ");
    output.write_raw(inline_renderer_->render(table->caption(), output));
    output.write_raw("*\n\n");
}
}  // namespace dans::document::connectors::markdown
