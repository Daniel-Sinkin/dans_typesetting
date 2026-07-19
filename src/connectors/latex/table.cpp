// Lower table structure while delegating every rich cell to the inline renderer.
#include "connectors/latex/table.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::connectors::latex
{
TableLatexAdapter::TableLatexAdapter(
    std::shared_ptr<const CoreParagraphInlineLatexRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A table LaTeX adapter requires an inline renderer"};
    }
}

auto TableLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Table::k_type_id;
}

auto TableLatexAdapter::serialize(const DocumentBlock& block, writers::LatexOutput& output) const
    -> void
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

    output.write_raw("\\begin{table}[htbp]\n\\centering\n\\begin{tabular}{");
    for (usize column{}; column < table->column_count(); ++column)
    {
        switch (table->column_alignment(column))
        {
            case plugins::TableColumnAlignment::left:
                output.write_raw("l");
                break;
            case plugins::TableColumnAlignment::center:
                output.write_raw("c");
                break;
            case plugins::TableColumnAlignment::right:
                output.write_raw("r");
                break;
        }
    }
    output.write_raw("}\n\\toprule\n");

    for (usize row_index{}; row_index < table->rows().size(); ++row_index)
    {
        const auto& row = table->rows()[row_index];
        for (usize column{}; column < row->cells().size(); ++column)
        {
            if (column != 0)
            {
                output.write_raw(" & ");
            }
            const auto& cell = row->cell(column);
            if (row_index < table->header_rows())
            {
                output.write_raw("\\bfseries ");
            }
            inline_renderer_->serialize(cell.inlines(), output);
        }
        output.write_raw(" \\\\\n");
        if (table->header_rows() != 0 && row_index + usize{1} == table->header_rows())
        {
            output.write_raw("\\midrule\n");
        }
    }

    output.write_raw("\\bottomrule\n\\end{tabular}\n\\caption{");
    inline_renderer_->serialize(table->caption(), output);
    output.write_raw("}\n");
    if (table->reference_id().has_value())
    {
        output.write_raw("\\label{");
        output.write_raw(table->reference_id()->value());
        output.write_raw("}\n");
    }
    output.write_raw("\\end{table}\n\n");
}
}  // namespace dans::document::connectors::latex
