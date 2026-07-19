// src/plugins/hyperlink.cpp — validate hyperlink targets and own their inline labels.
#include "plugins/hyperlink.hpp"

#include "plugins/text.hpp"

#include <stdexcept>

namespace
{
auto validate_target(const std::string_view target) -> void
{
    if (target.empty())
    {
        throw std::invalid_argument{"A hyperlink target must not be empty"};
    }

    for (const char character : target)
    {
        const auto byte = static_cast<unsigned char>(character);
        if (byte < 0x21U || byte == 0x7fU || character == '{' || character == '}'
            || character == '\\')
        {
            throw std::invalid_argument{
                "A hyperlink target must not contain whitespace, control characters, braces, or "
                "backslashes"
            };
        }
    }
}
}  // namespace

namespace dans::document::plugins
{
Hyperlink::Hyperlink(const std::string_view target) : target_{target}
{
    validate_target(target);
}

Hyperlink::Hyperlink(const std::string_view target, const std::string_view label)
    : Hyperlink{target}
{
    label_.add<Text>(label);
}

auto Hyperlink::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Hyperlink::target() const noexcept -> std::string_view
{
    return target_;
}

auto Hyperlink::label() noexcept -> InlineSequence&
{
    return label_;
}

auto Hyperlink::label() const noexcept -> const InlineSequence&
{
    return label_;
}
}  // namespace dans::document::plugins
