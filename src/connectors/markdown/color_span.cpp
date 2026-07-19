// src/connectors/markdown/color_span.cpp — render colour spans as constrained inline HTML.
#include "connectors/markdown/color_span.hpp"

#include <array>
#include <stdexcept>
#include <string>

namespace dans::document::connectors::markdown
{
namespace
{
auto hex_byte(const u8 value) -> std::string
{
    constexpr std::array<char, 16> k_hex_digits{
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'
    };
    std::string result{"00"};
    result[0] = k_hex_digits[static_cast<usize>(value >> 4u)];
    result[1] = k_hex_digits[static_cast<usize>(value & 0x0fu)];
    return result;
}
}  // namespace

auto ColorSpanMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::ColorSpan::k_type_id;
}

auto ColorSpanMarkdownAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output
) const -> void
{
    const auto* span = dynamic_cast<const plugins::ColorSpan*>(&node);
    if (span == nullptr)
    {
        throw std::invalid_argument{"The color-span adapter received a different inline type"};
    }
    if (span->inlines().nodes().empty())
    {
        throw std::invalid_argument{"A rendered color span requires inline content"};
    }
    const auto color = span->color();
    output.write_raw("<span style=\"color: #");
    output.write_raw(hex_byte(color.red));
    output.write_raw(hex_byte(color.green));
    output.write_raw(hex_byte(color.blue));
    output.write_raw("\">");
    output.write_inlines(span->inlines());
    output.write_raw("</span>");
}
}  // namespace dans::document::connectors::markdown
