// Equal-column layout grid with arbitrary block-bearing cells and boundary styles.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_GRID_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_GRID_HPP

#include "document.hpp"

#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace dans::document::plugins
{
enum class GridEdgeStyle : u8
{
    none,
    single,
    double_line,
};

struct GridGaps
{
    f64 row_em{};
    f64 column_em{};
};

// Grid is a layout primitive rather than a data table. Every row-major cell is
// one named BlockSequence and may therefore contain any number of blocks,
// including another Grid. Row/column spanning is deliberately absent.
class Grid final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.layout.grid";
    static constexpr usize k_maximum_dimension = 16;
    static constexpr usize k_maximum_cell_count = 64;
    static constexpr f64 k_maximum_gap_em = 16.0;

    Grid(usize row_count, usize column_count, GridGaps gaps = {});

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto child_sequence_count() const noexcept -> usize override;
    [[nodiscard]] auto child_sequence_id(usize index) const -> std::string_view override;
    [[nodiscard]] auto child_sequence(usize index) const -> const BlockSequence& override;

    [[nodiscard]] auto row_count() const noexcept -> usize;
    [[nodiscard]] auto column_count() const noexcept -> usize;
    [[nodiscard]] auto gaps() const noexcept -> GridGaps;
    [[nodiscard]] auto cell_sequence_id(usize row, usize column) const -> std::string_view;
    [[nodiscard]] auto cell(usize row, usize column) -> BlockSequence&;
    [[nodiscard]] auto cell(usize row, usize column) const -> const BlockSequence&;

    // Horizontal boundaries are indexed from the top (0) through the bottom
    // (row_count). Vertical boundaries analogously include left and right.
    [[nodiscard]] auto horizontal_edge(usize boundary_row) const -> GridEdgeStyle;
    [[nodiscard]] auto vertical_edge(usize boundary_column) const -> GridEdgeStyle;
    auto set_horizontal_edge(usize boundary_row, GridEdgeStyle style) -> void;
    auto set_vertical_edge(usize boundary_column, GridEdgeStyle style) -> void;
    auto set_outer_edges(GridEdgeStyle style) -> void;
    auto set_all_edges(GridEdgeStyle style) -> void;

  private:
    [[nodiscard]] auto cell_index(usize row, usize column) const -> usize;

    usize row_count_{};
    usize column_count_{};
    GridGaps gaps_{};
    std::vector<std::string> cell_sequence_ids_{};
    std::vector<std::unique_ptr<BlockSequence>> cells_{};
    std::vector<GridEdgeStyle> horizontal_edges_{};
    std::vector<GridEdgeStyle> vertical_edges_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_GRID_HPP
