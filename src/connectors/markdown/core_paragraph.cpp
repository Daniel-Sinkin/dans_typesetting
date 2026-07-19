// src/connectors/markdown/core_paragraph.cpp — render ordered inline prose as Markdown.
#include "connectors/markdown/core_paragraph.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>
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
    CoreParagraphMarkdownOutput& output, const std::string_view text, const std::string_view marker
) -> void
{
    const auto first = std::ranges::find_if_not(text, is_boundary_space);
    if (first == text.end())
    {
        output.write_text(text);
        return;
    }
    const auto last =
        std::ranges::find_if_not(text.rbegin(), text.rend(), is_boundary_space).base();
    const auto leading_size = static_cast<usize>(first - text.begin());
    const auto content_size = static_cast<usize>(last - first);
    output.write_text(text.substr(0, leading_size));
    output.write_raw(marker);
    output.write_text(text.substr(leading_size, content_size));
    output.write_raw(marker);
    output.write_text(text.substr(leading_size + content_size));
}
}  // namespace

CoreParagraphMarkdownOutput::CoreParagraphMarkdownOutput(
    std::string& buffer,
    const CoreParagraphInlineMarkdownRenderer& inline_renderer,
    writers::MarkdownOutput& context
) noexcept
    : buffer_{buffer}, inline_renderer_{inline_renderer}, context_{context}
{
}

auto CoreParagraphMarkdownOutput::write_raw(const std::string_view text) -> void
{
    buffer_.append(text);
}

auto CoreParagraphMarkdownOutput::write_text(const std::string_view text) -> void
{
    buffer_ += writers::escape_markdown_text(text);
}

auto CoreParagraphMarkdownOutput::write_inline(const plugins::InlineNode& node) -> void
{
    inline_renderer_.emit_inline(node, *this);
}

auto CoreParagraphMarkdownOutput::write_inlines(const plugins::InlineSequence& sequence) -> void
{
    for (const auto& node : sequence.nodes())
    {
        write_inline(*node);
    }
}

auto CoreParagraphMarkdownOutput::render_inlines(const plugins::InlineSequence& sequence) const
    -> std::string
{
    return inline_renderer_.render(sequence, context_);
}

auto CoreParagraphMarkdownOutput::context() noexcept -> writers::MarkdownOutput&
{
    return context_;
}

auto CoreParagraphInlineMarkdownRenderer::register_inline_adapter(
    std::unique_ptr<CoreParagraphInlineMarkdownAdapter> adapter
) -> void
{
    if (adapter == nullptr)
    {
        throw std::invalid_argument{"Cannot register a null paragraph Markdown adapter"};
    }
    if (adapter->inline_type_id().empty())
    {
        throw std::invalid_argument{"A paragraph Markdown adapter must have an inline type ID"};
    }
    if (supports_inline(adapter->inline_type_id()))
    {
        throw std::invalid_argument{
            "A paragraph Markdown adapter is already registered for inline type '"
            + std::string{adapter->inline_type_id()} + "'"
        };
    }
    inline_adapters_.push_back(std::move(adapter));
}

auto CoreParagraphInlineMarkdownRenderer::supports_inline(
    const std::string_view inline_type_id
) const noexcept -> bool
{
    return inline_adapter_for(inline_type_id) != nullptr;
}

auto CoreParagraphInlineMarkdownRenderer::render(
    const plugins::InlineSequence& sequence, writers::MarkdownOutput& context
) const -> std::string
{
    std::string buffer{};
    CoreParagraphMarkdownOutput output{buffer, *this, context};
    output.write_inlines(sequence);
    return buffer;
}

auto CoreParagraphInlineMarkdownRenderer::inline_adapter_for(
    const std::string_view inline_type_id
) const noexcept -> const CoreParagraphInlineMarkdownAdapter*
{
    const auto match = std::ranges::find_if(
        inline_adapters_,
        [inline_type_id](const std::unique_ptr<CoreParagraphInlineMarkdownAdapter>& adapter)
        { return adapter->inline_type_id() == inline_type_id; }
    );
    return match == inline_adapters_.end() ? nullptr : match->get();
}

auto CoreParagraphInlineMarkdownRenderer::emit_inline(
    const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output
) const -> void
{
    const auto* adapter = inline_adapter_for(node.type_id());
    if (adapter == nullptr)
    {
        throw std::runtime_error{
            "No paragraph Markdown adapter is registered for inline type '"
            + std::string{node.type_id()} + "'"
        };
    }
    adapter->serialize(node, output);
}

CoreParagraphMarkdownAdapter::CoreParagraphMarkdownAdapter(
    std::shared_ptr<const CoreParagraphInlineMarkdownRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A paragraph Markdown adapter requires an inline renderer"};
    }
}

auto CoreParagraphMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::CoreParagraph::k_type_id;
}

auto CoreParagraphMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* paragraph = dynamic_cast<const plugins::CoreParagraph*>(&block);
    if (paragraph == nullptr)
    {
        throw std::invalid_argument{"The paragraph adapter received a different content type"};
    }
    output.write_raw(inline_renderer_->render(paragraph->inlines(), output));
    output.write_raw("\n\n");
}

auto CoreTextMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::CoreText::k_type_id;
}

auto CoreTextMarkdownAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output
) const -> void
{
    const auto* text = dynamic_cast<const plugins::CoreText*>(&node);
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
    throw std::logic_error{"Unknown Core Text style"};
}
}  // namespace dans::document::connectors::markdown
