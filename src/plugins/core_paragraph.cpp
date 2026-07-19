#include "plugins/core_paragraph.hpp"

namespace dans::document::plugins
{
auto InlineSequence::nodes() const noexcept -> std::span<const std::unique_ptr<InlineNode>>
{
    return {nodes_.data(), nodes_.size()};
}

CoreText::CoreText(const std::string_view text, const TextStyle style) : text_{text}, style_{style}
{
}

auto CoreText::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto CoreText::text() const noexcept -> std::string_view
{
    return text_;
}

auto CoreText::style() const noexcept -> TextStyle
{
    return style_;
}

CoreParagraph::CoreParagraph(const std::string_view text)
{
    append_text(text);
}

auto CoreParagraph::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto CoreParagraph::inlines() noexcept -> InlineSequence&
{
    return inlines_;
}

auto CoreParagraph::inlines() const noexcept -> const InlineSequence&
{
    return inlines_;
}

auto CoreParagraph::append_text(const std::string_view text, const TextStyle style) -> CoreText&
{
    return inlines_.add<CoreText>(text, style);
}
}  // namespace dans::document::plugins
