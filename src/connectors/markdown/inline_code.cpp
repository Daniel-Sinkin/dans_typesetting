// src/connectors/markdown/inline_code.cpp — choose collision-free Markdown code spans.
#include "connectors/markdown/inline_code.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>

namespace dans::document::connectors::markdown
{
namespace
{
auto longest_backtick_run(const std::string_view text) noexcept -> usize
{
    usize longest{};
    usize current{};
    for (const char character : text)
    {
        if (character == '`')
        {
            ++current;
            longest = std::max(longest, current);
        }
        else
        {
            current = 0;
        }
    }
    return longest;
}
}  // namespace

auto InlineCodeMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::InlineCode::k_type_id;
}

auto InlineCodeMarkdownAdapter::serialize(
    const plugins::InlineNode& node, InlineMarkdownOutput& output
) const -> void
{
    const auto* code = dynamic_cast<const plugins::InlineCode*>(&node);
    if (code == nullptr)
    {
        throw std::invalid_argument{"The inline-code adapter received a different inline type"};
    }
    const auto fence = std::string(longest_backtick_run(code->code()) + usize{1}, '`');
    const bool needs_padding =
        !code->code().empty() && (code->code().front() == '`' || code->code().back() == '`');
    output.write_raw(fence);
    if (needs_padding)
    {
        output.write_raw(" ");
    }
    output.write_raw(code->code());
    if (needs_padding)
    {
        output.write_raw(" ");
    }
    output.write_raw(fence);
}
}  // namespace dans::document::connectors::markdown
