// src/connectors/latex/figure_pair.cpp — render two horizontal subfigures as LaTeX.
#include "connectors/latex/figure_pair.hpp"

#include "connectors/latex/graphics.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::connectors::latex
{
FigurePairLatexAdapter::FigurePairLatexAdapter(
    std::shared_ptr<const InlineLatexRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A figure-pair LaTeX adapter requires an inline renderer"};
    }
}

auto FigurePairLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::FigurePair::k_type_id;
}

auto FigurePairLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    const auto* figure = dynamic_cast<const plugins::FigurePair*>(&block);
    if (figure == nullptr)
    {
        throw std::invalid_argument{"The figure-pair adapter received a different block type"};
    }

    output.write_raw("\\begin{figure}[htbp]\n\\centering\n");
    const auto panels = figure->panels();
    for (usize index{}; index < panels.size(); ++index)
    {
        const auto& panel = panels[index];
        output.write_raw("\\begin{subfigure}[t]{");
        output.write_raw(detail::decimal(figure->panel_width().fraction()));
        output.write_raw("\\linewidth}\n\\centering\n\\includegraphics[width=\\linewidth]{");
        output.write_raw(detail::graphics_path(panel.source().path()));
        output.write_raw("}\n\\caption{");
        inline_renderer_->serialize(panel.caption(), output);
        output.write_raw("}\n");
        const auto& reference_id = panel.reference_id();
        if (reference_id.has_value())
        {
            output.write_raw("\\label{");
            output.write_raw(reference_id.value().value());
            output.write_raw("}\n");
        }
        output.write_raw("\\end{subfigure}");
        output.write_raw(index + usize{1} == panels.size() ? "\n" : "\\hfill\n");
    }
    output.write_raw("\\caption{");
    inline_renderer_->serialize(figure->caption(), output);
    output.write_raw("}\n");
    if (figure->reference_id().has_value())
    {
        output.write_raw("\\label{");
        output.write_raw(figure->reference_id().value().value());
        output.write_raw("}\n");
    }
    output.write_raw("\\end{figure}\n\n");
}
}  // namespace dans::document::connectors::latex
