// src/connectors/latex/latex_math.hpp — lower LaTeX-authored math to LaTeX.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_LATEX_MATH_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_LATEX_MATH_HPP

#include "connectors/latex/inline_sequence.hpp"
#include "plugins/latex_math.hpp"

namespace dans::document::connectors::latex
{
class LatexMathDisplayAdapter final : public writers::LatexBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;
};

class LatexMathInlineAdapter final : public InlineLatexAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineLatexOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_LATEX_MATH_HPP
