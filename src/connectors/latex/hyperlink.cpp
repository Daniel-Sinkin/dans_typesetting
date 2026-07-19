// src/connectors/latex/hyperlink.cpp — render semantic hyperlinks through hyperref.
#include "connectors/latex/hyperlink.hpp"

#include "plugins/hyperlink.hpp"

#include <stdexcept>

namespace
{
auto write_target(
    dans::document::connectors::latex::InlineLatexOutput& output, const std::string_view target
) -> void
{
    // These characters are valid URI data but active LaTeX syntax. hyperref
    // resolves the corresponding escaped tokens back to the intended target.
    for (const char character : target)
    {
        switch (character)
        {
            case '#':
                output.write_raw("\\#");
                break;
            case '%':
                output.write_raw("\\%");
                break;
            case '&':
                output.write_raw("\\&");
                break;
            case '_':
                output.write_raw("\\_");
                break;
            default:
                output.write_raw(std::string_view{&character, 1});
                break;
        }
    }
}
}  // namespace

namespace dans::document::connectors::latex
{
auto HyperlinkLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Hyperlink::k_type_id;
}

auto HyperlinkLatexAdapter::serialize(
    const plugins::InlineNode& node, InlineLatexOutput& output
) const -> void
{
    const auto* link = dynamic_cast<const plugins::Hyperlink*>(&node);
    if (link == nullptr)
    {
        throw std::invalid_argument{"The hyperlink adapter received a different inline type"};
    }

    output.write_raw("\\href{");
    write_target(output, link->target());
    output.write_raw("}{");
    if (link->label().nodes().empty())
    {
        output.write_text(link->target());
    }
    else
    {
        for (const auto& inline_node : link->label().nodes())
        {
            output.write_inline(*inline_node);
        }
    }
    output.write_raw("}");
}
}  // namespace dans::document::connectors::latex
