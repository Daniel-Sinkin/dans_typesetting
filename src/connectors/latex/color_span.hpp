#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_COLOR_SPAN_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_COLOR_SPAN_HPP

#include "connectors/latex/inline_sequence.hpp"
#include "plugins/color_span.hpp"

#include <string_view>

namespace dans::document::connectors::latex
{
class ColorSpanLatexAdapter final : public InlineLatexAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineLatexOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_COLOR_SPAN_HPP
