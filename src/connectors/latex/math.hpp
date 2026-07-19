#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_MATH_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_MATH_HPP

#include "connectors/latex/inline_sequence.hpp"
#include "plugins/math.hpp"

#include <string_view>

namespace dans::document::connectors::latex
{
class DisplayMathLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;
};

class InlineMathLatexAdapter final : public InlineLatexAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineLatexOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_MATH_HPP
