// src/plugins/footnote.cpp — implement the inline footnote payload.
#include "plugins/footnote.hpp"

namespace dans::document::plugins
{
Footnote::Footnote(const std::string_view text)
{
    append_text(text);
}

auto Footnote::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Footnote::inlines() noexcept -> InlineSequence&
{
    return inlines_;
}

auto Footnote::inlines() const noexcept -> const InlineSequence&
{
    return inlines_;
}

auto Footnote::append_text(const std::string_view text, const TextStyle style) -> Text&
{
    return inlines_.add<Text>(text, style);
}
}  // namespace dans::document::plugins
