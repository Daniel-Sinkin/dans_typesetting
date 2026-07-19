// src/plugins/text.cpp — implement the ordinary styled-text inline leaf.
#include "plugins/text.hpp"

namespace dans::document::plugins
{
Text::Text(const std::string_view text, const TextStyle style) : text_{text}, style_{style}
{
}

auto Text::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Text::text() const noexcept -> std::string_view
{
    return text_;
}

auto Text::style() const noexcept -> TextStyle
{
    return style_;
}
}  // namespace dans::document::plugins
