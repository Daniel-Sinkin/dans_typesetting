// src/connectors/markdown/footnote.cpp — render rich notes with Pandoc inline-footnote syntax.
#include "connectors/markdown/footnote.hpp"

#include <stdexcept>

namespace dans::document::connectors::markdown
{
auto FootnoteMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Footnote::k_type_id;
}

auto FootnoteMarkdownAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output
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
    output.write_raw("^[");
    for (const auto& inline_node : footnote->inlines().nodes())
    {
        if (inline_node->type_id() == plugins::Footnote::k_type_id)
        {
            throw std::invalid_argument{"A footnote cannot directly contain another footnote"};
        }
        output.write_inline(*inline_node);
    }
    output.write_raw("]");
}
}  // namespace dans::document::connectors::markdown
