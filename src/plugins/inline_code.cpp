// src/plugins/inline_code.cpp — validate and own semantic inline code.
#include "plugins/inline_code.hpp"

#include <stdexcept>

namespace dans::document::plugins
{
InlineCode::InlineCode(const std::string_view code) : code_{code}
{
    if (code.contains('\n') || code.contains('\r'))
    {
        throw std::invalid_argument{"Inline code cannot contain a line break"};
    }
}

auto InlineCode::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto InlineCode::code() const noexcept -> std::string_view
{
    return code_;
}
}  // namespace dans::document::plugins
