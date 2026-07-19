// src/connectors/latex/figure_pair.hpp — declare LaTeX lowering for figure pairs.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_FIGURE_PAIR_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_FIGURE_PAIR_HPP

#include "connectors/latex/core_paragraph.hpp"
#include "plugins/figure_pair.hpp"

#include <memory>
#include <string_view>

namespace dans::document::connectors::latex
{
class FigurePairLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    explicit FigurePairLatexAdapter(
        std::shared_ptr<const CoreParagraphInlineLatexRenderer> inline_renderer
    );

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;

  private:
    std::shared_ptr<const CoreParagraphInlineLatexRenderer> inline_renderer_{};
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_FIGURE_PAIR_HPP
