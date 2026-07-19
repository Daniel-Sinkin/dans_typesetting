// src/connectors/latex/footnote.cpp — render footnote content through the shared inline registry.
#include "connectors/latex/footnote.hpp"

#include <stdexcept>

namespace dans::document::connectors::latex
{
auto FootnoteLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Footnote::k_type_id;
}

auto FootnoteLatexAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphLatexOutput& output
) const -> void
{
    const auto* footnote = dynamic_cast<const plugins::Footnote*>(&node);
    if (footnote == nullptr)
    {
        throw std::invalid_argument{"The footnote adapter received a different inline type"};
    }
    if (footnote->inlines().nodes().empty())
    {
        throw std::invalid_argument{"A footnote requires at least one inline node"};
    }

    output.write_raw("\\footnote{");
    for (const auto& inline_node : footnote->inlines().nodes())
    {
        if (inline_node->type_id() == plugins::Footnote::k_type_id)
        {
            throw std::invalid_argument{"A footnote cannot directly contain another footnote"};
        }
        output.write_inline(*inline_node);
    }
    output.write_raw("}");
}
}  // namespace dans::document::connectors::latex
