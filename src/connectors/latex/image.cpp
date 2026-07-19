// src/connectors/latex/image.cpp — render inline images and figures as LaTeX.
#include "connectors/latex/image.hpp"

#include "connectors/latex/graphics.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::connectors::latex
{
auto InlineImageLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::InlineImage::k_type_id;
}

auto InlineImageLatexAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphLatexOutput& output
) const -> void
{
    const auto* image = dynamic_cast<const plugins::InlineImage*>(&node);
    if (image == nullptr)
    {
        throw std::invalid_argument{"The inline-image adapter received a different inline type"};
    }

    output.write_raw("\\raisebox{-0.15em}{\\includegraphics[height=");
    output.write_raw(detail::decimal(image->height().em()));
    output.write_raw("em]{");
    output.write_raw(detail::graphics_path(image->source().path()));
    output.write_raw("}}");
}

FigureLatexAdapter::FigureLatexAdapter(
    std::shared_ptr<const CoreParagraphInlineLatexRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A figure LaTeX adapter requires an inline renderer"};
    }
}

auto FigureLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Figure::k_type_id;
}

auto FigureLatexAdapter::serialize(const DocumentBlock& block, writers::LatexOutput& output) const
    -> void
{
    const auto* figure = dynamic_cast<const plugins::Figure*>(&block);
    if (figure == nullptr)
    {
        throw std::invalid_argument{"The figure adapter received a different block type"};
    }

    output.write_raw("\\begin{figure}[htbp]\n\\centering\n\\includegraphics[width=");
    output.write_raw(detail::decimal(figure->width().fraction()));
    output.write_raw("\\linewidth]{");
    output.write_raw(detail::graphics_path(figure->source().path()));
    output.write_raw("}\n\\caption{");
    inline_renderer_->serialize(figure->caption(), output);
    output.write_raw("}\n\\label{");
    output.write_raw(figure->reference_id().value());
    output.write_raw("}\n\\end{figure}\n\n");
}
}  // namespace dans::document::connectors::latex
