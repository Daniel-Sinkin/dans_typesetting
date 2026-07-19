// src/connectors/latex_like/paragraph.cpp — flatten supported inline text into paragraph layout.
#include "connectors/latex_like/paragraph.hpp"

#include "plugins/paragraph.hpp"
#include "plugins/text.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>
#include <utility>

namespace dans::document::connectors::latex_like
{
auto InlineTextOutput::append(const std::string_view text) -> void
{
    text_.append(text);
}

auto InlineTextRenderer::register_inline_adapter(std::unique_ptr<InlineTextAdapter> adapter) -> void
{
    if (adapter == nullptr)
    {
        throw std::invalid_argument{"Cannot register a null inline text-layout adapter"};
    }
    if (adapter->inline_type_id().empty())
    {
        throw std::invalid_argument{"An inline text-layout adapter requires a type ID"};
    }
    if (supports_inline(adapter->inline_type_id()))
    {
        throw std::invalid_argument{
            "An inline text-layout adapter is already registered for type '"
            + std::string{adapter->inline_type_id()} + "'"
        };
    }
    inline_adapters_.push_back(std::move(adapter));
}

auto InlineTextRenderer::supports_inline(const std::string_view inline_type_id) const noexcept
    -> bool
{
    return inline_adapter_for(inline_type_id) != nullptr;
}

auto InlineTextRenderer::render(const plugins::InlineSequence& sequence) const -> std::string
{
    InlineTextOutput output;
    for (const auto& node : sequence.nodes())
    {
        const auto* adapter = inline_adapter_for(node->type_id());
        if (adapter == nullptr)
        {
            throw std::runtime_error{
                "No LaTeX-like inline adapter is registered for inline type '"
                + std::string{node->type_id()} + "'"
            };
        }
        adapter->append(*node, output);
    }
    return std::move(output.text_);
}

auto InlineTextRenderer::inline_adapter_for(const std::string_view inline_type_id) const noexcept
    -> const InlineTextAdapter*
{
    const auto match = std::ranges::find_if(
        inline_adapters_,
        [inline_type_id](const std::unique_ptr<InlineTextAdapter>& adapter)
        { return adapter->inline_type_id() == inline_type_id; }
    );
    return match == inline_adapters_.end() ? nullptr : match->get();
}

ParagraphAdapter::ParagraphAdapter(std::shared_ptr<const InlineTextRenderer> inline_renderer)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A paragraph layout adapter requires an inline renderer"};
    }
}

auto ParagraphAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Paragraph::k_type_id;
}

auto ParagraphAdapter::layout(const DocumentBlock& block, layout::LatexLikeOutput& output) const
    -> void
{
    const auto* paragraph = dynamic_cast<const plugins::Paragraph*>(&block);
    if (paragraph == nullptr)
    {
        throw std::invalid_argument{"The paragraph layout adapter received another block type"};
    }
    output.write_paragraph(inline_renderer_->render(paragraph->inlines()));
}

auto TextAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Text::k_type_id;
}

auto TextAdapter::append(const plugins::InlineNode& node, InlineTextOutput& output) const -> void
{
    const auto* text = dynamic_cast<const plugins::Text*>(&node);
    if (text == nullptr)
    {
        throw std::invalid_argument{"The text layout adapter received another inline type"};
    }
    if (text->style() != plugins::TextStyle::normal)
    {
        throw std::runtime_error{
            "The initial LaTeX-like writer supports only normal-weight Roman text"
        };
    }
    output.append(text->text());
}
}  // namespace dans::document::connectors::latex_like
