// src/connectors/markdown/inline_sequence.cpp — render inline sequences through a registry.
#include "connectors/markdown/inline_sequence.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>
#include <utility>

namespace dans::document::connectors::markdown
{
InlineMarkdownOutput::InlineMarkdownOutput(
    std::string& buffer,
    const InlineMarkdownRenderer& renderer,
    writers::MarkdownOutput& context
) noexcept
    : buffer_{buffer}, renderer_{renderer}, context_{context}
{
}

auto InlineMarkdownOutput::write_raw(const std::string_view text) -> void
{
    buffer_.append(text);
}

auto InlineMarkdownOutput::write_text(const std::string_view text) -> void
{
    buffer_ += writers::escape_markdown_text(text);
}

auto InlineMarkdownOutput::write_inline(const plugins::InlineNode& node) -> void
{
    renderer_.emit_inline(node, *this);
}

auto InlineMarkdownOutput::write_inlines(const plugins::InlineSequence& sequence) -> void
{
    for (const auto& node : sequence.nodes())
    {
        write_inline(*node);
    }
}

auto InlineMarkdownOutput::render_inlines(const plugins::InlineSequence& sequence) const
    -> std::string
{
    return renderer_.render(sequence, context_);
}

auto InlineMarkdownOutput::context() noexcept -> writers::MarkdownOutput&
{
    return context_;
}

auto InlineMarkdownRenderer::register_inline_adapter(
    std::unique_ptr<InlineMarkdownAdapter> adapter
) -> void
{
    if (adapter == nullptr)
    {
        throw std::invalid_argument{"Cannot register a null inline Markdown adapter"};
    }
    if (adapter->inline_type_id().empty())
    {
        throw std::invalid_argument{"An inline Markdown adapter requires a type ID"};
    }
    if (supports_inline(adapter->inline_type_id()))
    {
        throw std::invalid_argument{
            "An inline Markdown adapter is already registered for type '"
            + std::string{adapter->inline_type_id()} + "'"
        };
    }
    inline_adapters_.push_back(std::move(adapter));
}

auto InlineMarkdownRenderer::supports_inline(const std::string_view inline_type_id) const noexcept
    -> bool
{
    return inline_adapter_for(inline_type_id) != nullptr;
}

auto InlineMarkdownRenderer::render(
    const plugins::InlineSequence& sequence, writers::MarkdownOutput& context
) const -> std::string
{
    std::string buffer{};
    InlineMarkdownOutput output{buffer, *this, context};
    output.write_inlines(sequence);
    return buffer;
}

auto InlineMarkdownRenderer::inline_adapter_for(
    const std::string_view inline_type_id
) const noexcept -> const InlineMarkdownAdapter*
{
    const auto match = std::ranges::find_if(
        inline_adapters_,
        [inline_type_id](const std::unique_ptr<InlineMarkdownAdapter>& adapter)
        { return adapter->inline_type_id() == inline_type_id; }
    );
    return match == inline_adapters_.end() ? nullptr : match->get();
}

auto InlineMarkdownRenderer::emit_inline(
    const plugins::InlineNode& node, InlineMarkdownOutput& output
) const -> void
{
    const auto* adapter = inline_adapter_for(node.type_id());
    if (adapter == nullptr)
    {
        throw std::runtime_error{
            "No Markdown adapter is registered for inline type '" + std::string{node.type_id()}
            + "'"
        };
    }
    adapter->serialize(node, output);
}
}  // namespace dans::document::connectors::markdown
