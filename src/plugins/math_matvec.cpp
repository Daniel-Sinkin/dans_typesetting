// Implement the matrix/vector authoring helpers over the core math grid.
#include "plugins/math_matvec.hpp"

#include <limits>
#include <stdexcept>
#include <utility>
#include <vector>

namespace dans::document::plugins
{
auto Math::MatVec::matrix_from_rows(std::vector<Row> rows) -> Math
{
    if (rows.empty())
    {
        throw std::invalid_argument{"A matrix requires at least one row"};
    }
    const auto column_count = rows.front().cells_.size();
    if (column_count == usize{0})
    {
        throw std::invalid_argument{"A matrix row cannot be empty"};
    }
    if (column_count > std::numeric_limits<usize>::max() / rows.size())
    {
        throw std::invalid_argument{"Matrix dimensions exceed the supported size"};
    }

    std::vector<Math> cells{};
    cells.reserve(rows.size() * column_count);
    for (auto& row : rows)
    {
        if (row.cells_.size() != column_count)
        {
            throw std::invalid_argument{"Every matrix row must have the same number of cells"};
        }
        for (auto& cell : row.cells_)
        {
            cells.push_back(std::move(cell));
        }
    }
    return bracket(Math::grid(rows.size(), column_count, std::move(cells)));
}

auto Math::MatVec::bracket(Math grid) -> Math
{
    auto result = Math::delimited(Math::Delimiter::square);
    result.body(std::move(grid));
    return result;
}
}  // namespace dans::document::plugins
