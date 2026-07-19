// src/connectors/markdown/hyperlink.cpp — render clickable Markdown links.
#include "connectors/markdown/hyperlink.hpp"

#include <stdexcept>

namespace dans::document::connectors::markdown
{
auto HyperlinkMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Hyperlink::k_type_id;
}

auto HyperlinkMarkdownAdapter::serialize(
    const plugins::InlineNode& node, InlineMarkdownOutput& output
) const -> void
{
    const auto* link = dynamic_cast<const plugins::Hyperlink*>(&node);
    if (link == nullptr)
    {
        throw std::invalid_argument{"The hyperlink adapter received a different inline type"};
    }
    output.write_raw("[");
    if (link->label().nodes().empty())
    {
        output.write_text(link->target());
    }
    else
    {
        output.write_inlines(link->label());
    }
    output.write_raw("](");
    output.write_raw(writers::markdown_link_destination(link->target()));
    output.write_raw(")");
}
}  // namespace dans::document::connectors::markdown
