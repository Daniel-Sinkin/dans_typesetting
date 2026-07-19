// src/plugins/paragraph.cpp — implement paragraph semantics.
#include "plugins/paragraph.hpp"

namespace dans::document::plugins
{
Paragraph::Paragraph(const std::string_view text)
{
    append_text(text);
}

auto Paragraph::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Paragraph::inlines() noexcept -> InlineSequence&
{
    return inlines_;
}

auto Paragraph::inlines() const noexcept -> const InlineSequence&
{
    return inlines_;
}

auto Paragraph::append_text(const std::string_view text, const TextStyle style) -> Text&
{
    return inlines_.add<Text>(text, style);
}
}  // namespace dans::document::plugins
