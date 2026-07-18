#include "connectors/latex/color_span.hpp"

#include <stdexcept>
#include <string>

namespace dans::document::connectors::latex
{
using plugins::ColorSpan;
using plugins::InlineNode;

auto ColorSpanLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return ColorSpan::k_type_id;
}

auto ColorSpanLatexAdapter::serialize(
    const InlineNode& node, CoreParagraphLatexOutput& output
) const -> void
{
    const auto* color_span = dynamic_cast<const ColorSpan*>(&node);
    if (color_span == nullptr)
    {
        throw std::invalid_argument{"The color-span adapter received a different inline type"};
    }

    const auto color = color_span->color();
    output.write_raw("\\textcolor[RGB]{");
    output.write_raw(std::to_string(color.red));
    output.write_raw(",");
    output.write_raw(std::to_string(color.green));
    output.write_raw(",");
    output.write_raw(std::to_string(color.blue));
    output.write_raw("}{");
    for (const auto& inline_node : color_span->inlines().nodes())
    {
        output.write_inline(*inline_node);
    }
    output.write_raw("}");
}
}  // namespace dans::document::connectors::latex
