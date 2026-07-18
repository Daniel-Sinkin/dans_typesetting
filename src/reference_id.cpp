// src/reference_id.cpp — validate and store stable semantic reference identifiers.
#include "reference_id.hpp"

#include <stdexcept>

namespace
{
auto is_ascii_letter(const char character) noexcept -> bool
{
    return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z');
}

auto is_ascii_digit(const char character) noexcept -> bool
{
    return character >= '0' && character <= '9';
}

auto is_valid_reference_character(const char character) noexcept -> bool
{
    return is_ascii_letter(character) || is_ascii_digit(character) || character == '-'
           || character == '_' || character == '.' || character == ':';
}
}  // namespace

namespace dans::document
{
ReferenceId::ReferenceId(const std::string_view value) : value_{value}
{
    if (value.empty())
    {
        throw std::invalid_argument{"A reference ID must not be empty"};
    }
    if (!is_ascii_letter(value.front()))
    {
        throw std::invalid_argument{"A reference ID must begin with an ASCII letter"};
    }
    for (const char character : value)
    {
        if (!is_valid_reference_character(character))
        {
            throw std::invalid_argument{
                "A reference ID may contain only ASCII letters, digits, '-', '_', '.', and ':'"
            };
        }
    }
}

auto ReferenceId::value() const noexcept -> std::string_view
{
    return value_;
}
}  // namespace dans::document
