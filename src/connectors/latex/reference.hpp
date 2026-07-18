// src/connectors/latex/reference.hpp — declare LaTeX rendering for semantic references.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_REFERENCE_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_REFERENCE_HPP

#include "connectors/latex/core_paragraph.hpp"
#include "plugins/reference.hpp"

#include <string_view>

namespace dans::document::connectors::latex
{
class ReferenceLatexAdapter final : public CoreParagraphInlineLatexAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, CoreParagraphLatexOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_REFERENCE_HPP
