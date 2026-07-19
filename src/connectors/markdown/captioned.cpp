// Derive generic caption ordinals from the stored category string.
#include "connectors/markdown/captioned.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::connectors::markdown
{
CaptionedMarkdownAdapter::CaptionedMarkdownAdapter(
    std::shared_ptr<const InlineMarkdownRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A Captioned Markdown adapter requires an inline renderer"};
    }
}

auto CaptionedMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Captioned::k_type_id;
}

auto CaptionedMarkdownAdapter::targets(const DocumentBlock& block) const
    -> std::vector<writers::MarkdownTargetDescriptor>
{
    const auto* captioned = dynamic_cast<const plugins::Captioned*>(&block);
    if (captioned == nullptr)
    {
        throw std::invalid_argument{"The Captioned adapter received a different block type"};
    }
    if (!captioned->category().has_value())
    {
        return {};
    }
    return {{
        .reference_id =
            captioned->reference_id().has_value() ? &captioned->reference_id().value() : nullptr,
        .label = captioned->category().value(),
        .numbering_series = captioned->category().value(),
    }};
}

auto CaptionedMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* captioned = dynamic_cast<const plugins::Captioned*>(&block);
    if (captioned == nullptr)
    {
        throw std::invalid_argument{"The Captioned adapter received a different block type"};
    }
    if (!captioned->has_content())
    {
        throw std::logic_error{"A Captioned block must own exactly one content block"};
    }
    output.write_blocks(captioned->content());
    const auto caption = inline_renderer_->render(captioned->caption(), output);
    if (!captioned->category().has_value() && caption.empty())
    {
        return;
    }
    if (captioned->reference_id().has_value())
    {
        output.write_anchor(captioned->reference_id().value());
    }
    output.write_raw("*");
    if (captioned->category().has_value())
    {
        output.write_text(captioned->category().value());
        output.write_raw(" ");
        output.write_raw(output.target_number(block));
        if (!caption.empty())
        {
            output.write_raw(": ");
        }
    }
    output.write_raw(caption);
    output.write_raw("*\n\n");
}
}  // namespace dans::document::connectors::markdown
