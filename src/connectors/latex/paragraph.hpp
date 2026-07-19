// src/connectors/latex/paragraph.hpp — connect text and paragraph plugins to LaTeX.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_PARAGRAPH_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_PARAGRAPH_HPP

#include "connectors/latex/inline_sequence.hpp"
#include "plugins/paragraph.hpp"

#include <memory>
#include <string_view>

namespace dans::document::connectors::latex
{
class ParagraphLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    explicit ParagraphLatexAdapter(std::shared_ptr<const InlineLatexRenderer> inline_renderer);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;

  private:
    std::shared_ptr<const InlineLatexRenderer> inline_renderer_{};
};

class TextLatexAdapter final : public InlineLatexAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineLatexOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_PARAGRAPH_HPP
