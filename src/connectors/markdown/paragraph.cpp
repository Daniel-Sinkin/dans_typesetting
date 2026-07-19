// src/connectors/markdown/paragraph.cpp — render text and paragraphs as Markdown.
#include "connectors/markdown/paragraph.hpp"

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace dans::document::connectors::markdown
{
namespace
{
auto is_boundary_space(const char character) noexcept -> bool
{
    return character == ' ' || character == '\t' || character == '\n' || character == '\r';
}

auto write_emphasized_text(
    InlineMarkdownOutput& output, const std::string_view text, const std::string_view marker
) -> void
{
    const auto first = std::ranges::find_if_not(text, is_boundary_space);
    if (first == text.end())
    {
        output.write_text(text);
        return;
    }
    const auto last = std::ranges::find_if_not(text.rbegin(), text.rend(), is_boundary_space).base();
    const auto leading_size = static_cast<usize>(first - text.begin());
    const auto content_size = static_cast<usize>(last - first);
    output.write_text(text.substr(0, leading_size));
    output.write_raw(marker);
    output.write_text(text.substr(leading_size, content_size));
    output.write_raw(marker);
    output.write_text(text.substr(leading_size + content_size));
}
}  // namespace

ParagraphMarkdownAdapter::ParagraphMarkdownAdapter(
    std::shared_ptr<const InlineMarkdownRenderer> renderer
)
    : renderer_{std::move(renderer)}
{
    if (renderer_ == nullptr)
    {
        throw std::invalid_argument{"A paragraph Markdown adapter requires an inline renderer"};
    }
}

auto ParagraphMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Paragraph::k_type_id;
}

auto ParagraphMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* paragraph = dynamic_cast<const plugins::Paragraph*>(&block);
    if (paragraph == nullptr)
    {
        throw std::invalid_argument{"The paragraph adapter received a different content type"};
    }
    output.write_raw(renderer_->render(paragraph->inlines(), output));
    output.write_raw("\n\n");
}

auto TextMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Text::k_type_id;
}

auto TextMarkdownAdapter::serialize(
    const plugins::InlineNode& node, InlineMarkdownOutput& output
) const -> void
{
    const auto* text = dynamic_cast<const plugins::Text*>(&node);
    if (text == nullptr)
    {
        throw std::invalid_argument{"The text adapter received a different inline type"};
    }
    switch (text->style())
    {
        case plugins::TextStyle::normal:
            output.write_text(text->text());
            return;
        case plugins::TextStyle::bold:
            write_emphasized_text(output, text->text(), "**");
            return;
        case plugins::TextStyle::italic:
            write_emphasized_text(output, text->text(), "*");
            return;
        case plugins::TextStyle::bold_italic:
            write_emphasized_text(output, text->text(), "***");
            return;
    }
    throw std::logic_error{"Unknown text style"};
}
}  // namespace dans::document::connectors::markdown
