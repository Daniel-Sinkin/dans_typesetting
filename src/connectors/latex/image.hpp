// src/connectors/latex/image.hpp — declare LaTeX rendering for images and figures.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_IMAGE_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_IMAGE_HPP

#include "connectors/latex/inline_sequence.hpp"
#include "plugins/image.hpp"

#include <memory>
#include <string_view>

namespace dans::document::connectors::latex
{
class InlineImageLatexAdapter final : public InlineLatexAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineLatexOutput& output) const
        -> void override;
};

class FigureLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    explicit FigureLatexAdapter(std::shared_ptr<const InlineLatexRenderer> inline_renderer);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;

  private:
    std::shared_ptr<const InlineLatexRenderer> inline_renderer_{};
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_IMAGE_HPP
