// Render equal-width Grid cells while retaining nesting and explicit boundaries.
#include "connectors/latex/grid.hpp"

#include "connectors/latex/graphics.hpp"

#include <stdexcept>
#include <string>
#include <string_view>

namespace dans::document::connectors::latex
{
namespace
{
auto edge_token(const plugins::GridEdgeStyle style) -> std::string_view
{
    switch (style)
    {
        case plugins::GridEdgeStyle::none:
            return {};
        case plugins::GridEdgeStyle::single:
            return "|";
        case plugins::GridEdgeStyle::double_line:
            return "||";
    }
    throw std::logic_error{"Unknown Grid edge style"};
}

auto write_horizontal_edge(writers::LatexOutput& output, const plugins::GridEdgeStyle style) -> void
{
    switch (style)
    {
        case plugins::GridEdgeStyle::none:
            return;
        case plugins::GridEdgeStyle::single:
            output.write_raw("\\hline\n");
            return;
        case plugins::GridEdgeStyle::double_line:
            output.write_raw("\\hline\\hline\n");
            return;
    }
    throw std::logic_error{"Unknown Grid edge style"};
}

auto write_vertical_gap(
    writers::LatexOutput& output, const f64 half_gap_em, const plugins::GridEdgeStyle boundary_style
) -> void
{
    output.write_raw("@{\\hspace{");
    output.write_raw(detail::decimal(half_gap_em));
    output.write_raw("em}}");
    output.write_raw(edge_token(boundary_style));
    output.write_raw("@{\\hspace{");
    output.write_raw(detail::decimal(half_gap_em));
    output.write_raw("em}}");
}

auto write_row_gap(writers::LatexOutput& output, const f64 half_gap_em) -> void
{
    if (half_gap_em == 0.0)
    {
        return;
    }
    output.write_raw("\\noalign{\\vskip ");
    output.write_raw(detail::decimal(half_gap_em));
    output.write_raw("em}\n");
}

struct VerticalRuleExtent
{
    usize rule_count{};
    usize double_separator_count{};
};

auto vertical_rule_extent(const plugins::Grid& grid) -> VerticalRuleExtent
{
    auto extent = VerticalRuleExtent{};
    for (usize boundary{}; boundary <= grid.column_count(); ++boundary)
    {
        switch (grid.vertical_edge(boundary))
        {
            case plugins::GridEdgeStyle::none:
                break;
            case plugins::GridEdgeStyle::single:
                ++extent.rule_count;
                break;
            case plugins::GridEdgeStyle::double_line:
                extent.rule_count += usize{2};
                ++extent.double_separator_count;
                break;
        }
    }
    return extent;
}
}  // namespace

auto GridLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Grid::k_type_id;
}

auto GridLatexAdapter::serialize(const DocumentBlock& block, writers::LatexOutput& output) const
    -> void
{
    const auto* grid = dynamic_cast<const plugins::Grid*>(&block);
    if (grid == nullptr)
    {
        throw std::invalid_argument{"The Grid adapter received a different block type"};
    }

    const auto gaps = grid->gaps();
    const auto total_column_gap = gaps.column_em * static_cast<f64>(grid->column_count() - 1);
    const auto half_column_gap = gaps.column_em / 2.0;
    const auto half_row_gap = gaps.row_em / 2.0;
    const auto rule_extent = vertical_rule_extent(*grid);
    auto cell_width = R"(p{\dimexpr(\linewidth-)" + detail::decimal(total_column_gap) + "em";
    if (rule_extent.rule_count != usize{0})
    {
        cell_width += "-" + std::to_string(rule_extent.rule_count) + R"(\arrayrulewidth)";
    }
    if (rule_extent.double_separator_count != usize{0})
    {
        cell_width +=
            "-" + std::to_string(rule_extent.double_separator_count) + R"(\doublerulesep)";
    }
    cell_width += ")/" + std::to_string(grid->column_count()) + R"(\relax})";

    output.write_raw(
        "\\begingroup\n\\setlength{\\tabcolsep}{0pt}\n\\begin{center}\n\\begin{tabular}{@{}"
    );
    output.write_raw(edge_token(grid->vertical_edge(0)));
    for (usize column{}; column < grid->column_count(); ++column)
    {
        output.write_raw(cell_width);
        if (column + usize{1} < grid->column_count())
        {
            write_vertical_gap(output, half_column_gap, grid->vertical_edge(column + usize{1}));
        }
    }
    output.write_raw(edge_token(grid->vertical_edge(grid->column_count())));
    output.write_raw("@{}}\n");

    write_horizontal_edge(output, grid->horizontal_edge(0));
    for (usize row{}; row < grid->row_count(); ++row)
    {
        for (usize column{}; column < grid->column_count(); ++column)
        {
            if (column != 0)
            {
                output.write_raw(" & ");
            }
            output.write_raw(
                "\\begin{minipage}[t]{\\linewidth}\\vspace{0pt}\n"
                "\\renewenvironment{figure}[1][]{\\par\\captionsetup{type=figure}\\centering}{"
                "\\par}\n"
                "\\renewenvironment{table}[1][]{\\par\\captionsetup{type=table}\\centering}{\\par}"
                "\n"
            );
            if (grid->cell(row, column).blocks().empty())
            {
                output.write_raw("\\strut\n");
            }
            else
            {
                output.write_blocks(grid->cell(row, column));
            }
            output.write_raw("\\end{minipage}");
        }
        output.write_raw(" \\\\\n");
        if (row + usize{1} < grid->row_count())
        {
            write_row_gap(output, half_row_gap);
            write_horizontal_edge(output, grid->horizontal_edge(row + usize{1}));
            write_row_gap(output, half_row_gap);
        }
    }
    write_horizontal_edge(output, grid->horizontal_edge(grid->row_count()));
    output.write_raw("\\end{tabular}\n\\end{center}\n\\endgroup\n\n");
}
}  // namespace dans::document::connectors::latex
