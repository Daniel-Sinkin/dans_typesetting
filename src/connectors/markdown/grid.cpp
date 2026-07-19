// Flatten Grid cells without dropping nested semantic content.
#include "connectors/markdown/grid.hpp"

#include <stdexcept>
#include <string>

namespace dans::document::connectors::markdown
{
auto GridMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Grid::k_type_id;
}

auto GridMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* grid = dynamic_cast<const plugins::Grid*>(&block);
    if (grid == nullptr)
    {
        throw std::invalid_argument{"The Grid adapter received a different block type"};
    }

    output.write_raw("<!-- Grid layout flattened row-major: ");
    output.write_raw(std::to_string(grid->row_count()));
    output.write_raw(" x ");
    output.write_raw(std::to_string(grid->column_count()));
    output.write_raw(" -->\n\n");
    for (usize row{}; row < grid->row_count(); ++row)
    {
        for (usize column{}; column < grid->column_count(); ++column)
        {
            output.write_raw("<!-- Grid cell ");
            output.write_raw(std::to_string(row + usize{1}));
            output.write_raw(", ");
            output.write_raw(std::to_string(column + usize{1}));
            output.write_raw(" -->\n\n");
            output.write_blocks(grid->cell(row, column));
        }
    }
}
}  // namespace dans::document::connectors::markdown
