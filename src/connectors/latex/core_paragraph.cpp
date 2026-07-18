#include "connectors/latex/core_paragraph.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>
#include <utility>

namespace dans::document::connectors::latex
{
using plugins::CoreParagraph;
using plugins::CoreText;
using plugins::InlineNode;

CoreParagraphLatexOutput::CoreParagraphLatexOutput(
    writers::LatexOutput& output, const CoreParagraphInlineLatexRenderer& inline_renderer
) noexcept
    : output_{output}, inline_renderer_{inline_renderer}
{
}

auto CoreParagraphLatexOutput::write_raw(const std::string_view text) -> void
{
    output_.write_raw(text);
}

auto CoreParagraphLatexOutput::write_text(const std::string_view text) -> void
{
    output_.write_text(text);
}

auto CoreParagraphLatexOutput::write_inline(const InlineNode& node) -> void
{
    inline_renderer_.emit_inline(node, *this);
}

auto CoreParagraphInlineLatexRenderer::register_inline_adapter(
    std::unique_ptr<CoreParagraphInlineLatexAdapter> adapter
) -> void
{
    if (adapter == nullptr)
    {
        throw std::invalid_argument{"Cannot register a null paragraph inline adapter"};
    }
    if (adapter->inline_type_id().empty())
    {
        throw std::invalid_argument{"A paragraph inline adapter must have an inline type ID"};
    }
    if (supports_inline(adapter->inline_type_id()))
    {
        throw std::invalid_argument{
            "A paragraph inline adapter is already registered for inline type '"
            + std::string{adapter->inline_type_id()} + "'"
        };
    }

    inline_adapters_.push_back(std::move(adapter));
}

auto CoreParagraphInlineLatexRenderer::supports_inline(
    const std::string_view inline_type_id
) const noexcept -> bool
{
    return inline_adapter_for(inline_type_id) != nullptr;
}

auto CoreParagraphInlineLatexRenderer::serialize(
    const plugins::InlineSequence& sequence, writers::LatexOutput& output
) const -> void
{
    CoreParagraphLatexOutput paragraph_output{output, *this};
    for (const auto& inline_node : sequence.nodes())
    {
        paragraph_output.write_inline(*inline_node);
    }
}

auto CoreParagraphInlineLatexRenderer::inline_adapter_for(
    const std::string_view inline_type_id
) const noexcept -> const CoreParagraphInlineLatexAdapter*
{
    const auto match = std::ranges::find_if(
        inline_adapters_,
        [inline_type_id](const std::unique_ptr<CoreParagraphInlineLatexAdapter>& adapter)
        { return adapter->inline_type_id() == inline_type_id; }
    );
    return match == inline_adapters_.end() ? nullptr : match->get();
}

auto CoreParagraphInlineLatexRenderer::emit_inline(
    const InlineNode& node, CoreParagraphLatexOutput& output
) const -> void
{
    const auto* adapter = inline_adapter_for(node.type_id());
    if (adapter == nullptr)
    {
        throw std::runtime_error{
            "No paragraph LaTeX adapter is registered for inline type '"
            + std::string{node.type_id()} + "'"
        };
    }
    adapter->serialize(node, output);
}

CoreParagraphLatexAdapter::CoreParagraphLatexAdapter(
    std::shared_ptr<const CoreParagraphInlineLatexRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A paragraph LaTeX adapter requires an inline renderer"};
    }
}

auto CoreParagraphLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return CoreParagraph::k_type_id;
}

auto CoreParagraphLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    const auto* paragraph = dynamic_cast<const CoreParagraph*>(&block);
    if (paragraph == nullptr)
    {
        throw std::invalid_argument{"The paragraph adapter received a different content type"};
    }

    inline_renderer_->serialize(paragraph->inlines(), output);
    output.write_raw("\n\n");
}

auto CoreTextLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return CoreText::k_type_id;
}

auto CoreTextLatexAdapter::serialize(const InlineNode& node, CoreParagraphLatexOutput& output) const
    -> void
{
    const auto* text = dynamic_cast<const CoreText*>(&node);
    if (text == nullptr)
    {
        throw std::invalid_argument{"The text adapter received a different inline type"};
    }

    output.write_text(text->text());
}
}  // namespace dans::document::connectors::latex
