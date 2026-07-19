// Validate rectangular Grid structure and expose every cell as a stable endpoint.
#include "plugins/grid.hpp"

#include <algorithm>
#include <cmath>
#include <memory>
#include <stdexcept>
#include <string>

namespace dans::document::plugins
{
namespace
{
auto valid_gap(const f64 value) noexcept -> bool
{
    return std::isfinite(value) && value >= 0.0 && value <= Grid::k_maximum_gap_em;
}

auto validate_dimensions(const usize rows, const usize columns) -> usize
{
    if (rows == usize{0} || columns == usize{0} || rows > Grid::k_maximum_dimension
        || columns > Grid::k_maximum_dimension || rows > Grid::k_maximum_cell_count / columns)
    {
        throw std::invalid_argument{"A Grid requires dimensions in [1, 16] and at most 64 cells"};
    }
    return rows * columns;
}
}  // namespace

Grid::Grid(const usize row_count, const usize column_count, const GridGaps gaps)
    : row_count_{row_count}, column_count_{column_count}, gaps_{gaps}
{
    const auto cell_count = validate_dimensions(row_count_, column_count_);
    if (!valid_gap(gaps_.row_em) || !valid_gap(gaps_.column_em))
    {
        throw std::invalid_argument{"Grid gaps must be finite em values in [0, 16]"};
    }

    cell_sequence_ids_.reserve(cell_count);
    cells_.reserve(cell_count);
    for (usize row{}; row < row_count_; ++row)
    {
        for (usize column{}; column < column_count_; ++column)
        {
            cell_sequence_ids_.push_back(
                "cell:" + std::to_string(row) + ":" + std::to_string(column)
            );
            cells_.push_back(std::make_unique<BlockSequence>());
        }
    }
    horizontal_edges_.resize(row_count_ + usize{1}, GridEdgeStyle::none);
    vertical_edges_.resize(column_count_ + usize{1}, GridEdgeStyle::none);
}

auto Grid::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Grid::child_sequence_count() const noexcept -> usize
{
    return cells_.size();
}

auto Grid::child_sequence_id(const usize index) const -> std::string_view
{
    return cell_sequence_ids_.at(index);
}

auto Grid::child_sequence(const usize index) const -> const BlockSequence&
{
    return *cells_.at(index);
}

auto Grid::row_count() const noexcept -> usize
{
    return row_count_;
}

auto Grid::column_count() const noexcept -> usize
{
    return column_count_;
}

auto Grid::gaps() const noexcept -> GridGaps
{
    return gaps_;
}

auto Grid::cell_sequence_id(const usize row, const usize column) const -> std::string_view
{
    return cell_sequence_ids_.at(cell_index(row, column));
}

auto Grid::cell(const usize row, const usize column) -> BlockSequence&
{
    return *cells_.at(cell_index(row, column));
}

auto Grid::cell(const usize row, const usize column) const -> const BlockSequence&
{
    return *cells_.at(cell_index(row, column));
}

auto Grid::horizontal_edge(const usize boundary_row) const -> GridEdgeStyle
{
    return horizontal_edges_.at(boundary_row);
}

auto Grid::vertical_edge(const usize boundary_column) const -> GridEdgeStyle
{
    return vertical_edges_.at(boundary_column);
}

auto Grid::set_horizontal_edge(const usize boundary_row, const GridEdgeStyle style) -> void
{
    horizontal_edges_.at(boundary_row) = style;
}

auto Grid::set_vertical_edge(const usize boundary_column, const GridEdgeStyle style) -> void
{
    vertical_edges_.at(boundary_column) = style;
}

auto Grid::set_outer_edges(const GridEdgeStyle style) -> void
{
    horizontal_edges_.front() = style;
    horizontal_edges_.back() = style;
    vertical_edges_.front() = style;
    vertical_edges_.back() = style;
}

auto Grid::set_all_edges(const GridEdgeStyle style) -> void
{
    std::ranges::fill(horizontal_edges_, style);
    std::ranges::fill(vertical_edges_, style);
}

auto Grid::cell_index(const usize row, const usize column) const -> usize
{
    if (row >= row_count_ || column >= column_count_)
    {
        throw std::out_of_range{"Grid cell coordinates are outside the rectangular extent"};
    }
    return row * column_count_ + column;
}
}  // namespace dans::document::plugins
