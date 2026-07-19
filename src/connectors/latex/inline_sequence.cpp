// src/connectors/latex/inline_sequence.cpp — render inline sequences through a registry.
#include "connectors/latex/inline_sequence.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>
#include <utility>

namespace dans::document::connectors::latex
{
InlineLatexOutput::InlineLatexOutput(
    writers::LatexOutput& output, const InlineLatexRenderer& renderer
) noexcept
    : output_{output}, renderer_{renderer}
{
}

auto InlineLatexOutput::write_raw(const std::string_view text) -> void
{
    output_.write_raw(text);
}

auto InlineLatexOutput::write_text(const std::string_view text) -> void
{
    output_.write_text(text);
}

auto InlineLatexOutput::write_inline(const plugins::InlineNode& node) -> void
{
    renderer_.emit_inline(node, *this);
}

auto InlineLatexRenderer::register_inline_adapter(std::unique_ptr<InlineLatexAdapter> adapter)
    -> void
{
    if (adapter == nullptr)
    {
        throw std::invalid_argument{"Cannot register a null inline LaTeX adapter"};
    }
    if (adapter->inline_type_id().empty())
    {
        throw std::invalid_argument{"An inline LaTeX adapter requires a type ID"};
    }
    if (supports_inline(adapter->inline_type_id()))
    {
        throw std::invalid_argument{
            "An inline LaTeX adapter is already registered for type '"
            + std::string{adapter->inline_type_id()} + "'"
        };
    }
    inline_adapters_.push_back(std::move(adapter));
}

auto InlineLatexRenderer::supports_inline(const std::string_view inline_type_id) const noexcept
    -> bool
{
    return inline_adapter_for(inline_type_id) != nullptr;
}

auto InlineLatexRenderer::serialize(
    const plugins::InlineSequence& sequence, writers::LatexOutput& output
) const -> void
{
    InlineLatexOutput inline_output{output, *this};
    for (const auto& node : sequence.nodes())
    {
        inline_output.write_inline(*node);
    }
}

auto InlineLatexRenderer::inline_adapter_for(const std::string_view inline_type_id) const noexcept
    -> const InlineLatexAdapter*
{
    const auto match = std::ranges::find_if(
        inline_adapters_,
        [inline_type_id](const std::unique_ptr<InlineLatexAdapter>& adapter)
        { return adapter->inline_type_id() == inline_type_id; }
    );
    return match == inline_adapters_.end() ? nullptr : match->get();
}

auto InlineLatexRenderer::emit_inline(
    const plugins::InlineNode& node, InlineLatexOutput& output
) const -> void
{
    const auto* adapter = inline_adapter_for(node.type_id());
    if (adapter == nullptr)
    {
        throw std::runtime_error{
            "No LaTeX adapter is registered for inline type '" + std::string{node.type_id()} + "'"
        };
    }
    adapter->serialize(node, output);
}
}  // namespace dans::document::connectors::latex
