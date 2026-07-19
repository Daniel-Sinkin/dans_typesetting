// src/connectors/markdown/image.cpp — emit native Markdown image syntax and captions.
#include "connectors/markdown/image.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::connectors::markdown
{
auto InlineImageMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::InlineImage::k_type_id;
}

auto InlineImageMarkdownAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output
) const -> void
{
    const auto* image = dynamic_cast<const plugins::InlineImage*>(&node);
    if (image == nullptr)
    {
        throw std::invalid_argument{"The inline-image adapter received a different inline type"};
    }
    output.write_raw("![](");
    output.write_raw(writers::markdown_link_destination(image->source().path().generic_string()));
    output.write_raw(")");
}

FigureMarkdownAdapter::FigureMarkdownAdapter(
    std::shared_ptr<const CoreParagraphInlineMarkdownRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A figure Markdown adapter requires an inline renderer"};
    }
}

auto FigureMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Figure::k_type_id;
}

auto FigureMarkdownAdapter::targets(const DocumentBlock& block) const
    -> std::vector<writers::MarkdownTargetDescriptor>
{
    const auto* figure = dynamic_cast<const plugins::Figure*>(&block);
    if (figure == nullptr)
    {
        throw std::invalid_argument{"The figure adapter received a different block type"};
    }
    return {{
        .reference_id = &figure->reference_id(),
        .label = "Figure",
        .numbering_series = "figure",
    }};
}

auto FigureMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* figure = dynamic_cast<const plugins::Figure*>(&block);
    if (figure == nullptr)
    {
        throw std::invalid_argument{"The figure adapter received a different block type"};
    }
    const auto caption = inline_renderer_->render(figure->caption(), output);
    output.write_anchor(figure->reference_id());
    output.write_raw("![](");
    output.write_raw(writers::markdown_link_destination(figure->source().path().generic_string()));
    output.write_raw(")\n\n*Figure ");
    output.write_raw(output.target_number(block));
    output.write_raw(": ");
    output.write_raw(caption);
    output.write_raw("*\n\n");
}
}  // namespace dans::document::connectors::markdown
