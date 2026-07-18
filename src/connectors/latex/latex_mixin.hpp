#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_LATEX_MIXIN_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_LATEX_MIXIN_HPP

#include "connectors/latex/core_paragraph.hpp"
#include "plugins/latex_mixin.hpp"

#include <string_view>

namespace dans::document::connectors::latex
{
class LatexBlockAdapter final : public writers::LatexBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;
};

class InlineLatexAdapter final : public CoreParagraphInlineLatexAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, CoreParagraphLatexOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_LATEX_MIXIN_HPP
