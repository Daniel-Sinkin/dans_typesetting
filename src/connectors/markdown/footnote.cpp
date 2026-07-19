// src/connectors/markdown/footnote.cpp — render rich notes with reference-style syntax.
#include "connectors/markdown/footnote.hpp"

#include <stdexcept>

namespace dans::document::connectors::markdown
{
auto FootnoteMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Footnote::k_type_id;
}

auto FootnoteMarkdownAdapter::serialize(
    const plugins::InlineNode& node, InlineMarkdownOutput& output
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
    for (const auto& inline_node : footnote->inlines().nodes())
    {
        if (inline_node->type_id() == plugins::Footnote::k_type_id)
        {
            throw std::invalid_argument{"A footnote cannot directly contain another footnote"};
        }
    }
    const auto content = output.render_inlines(footnote->inlines());
    const auto number = output.context().register_footnote(content);
    output.write_raw("[^");
    output.write_raw(number);
    output.write_raw("]");
}
}  // namespace dans::document::connectors::markdown
