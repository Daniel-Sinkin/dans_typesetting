// src/connectors/latex/inline_code.hpp — connect semantic inline code to LaTeX.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_INLINE_CODE_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_INLINE_CODE_HPP

#include "connectors/latex/core_paragraph.hpp"

#include <string_view>

namespace dans::document::connectors::latex
{
class InlineCodeLatexAdapter final : public CoreParagraphInlineLatexAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, CoreParagraphLatexOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_INLINE_CODE_HPP
