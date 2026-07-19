// src/connectors/markdown/latex_math.hpp — lower LaTeX-authored math to Markdown math.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_LATEX_MATH_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_LATEX_MATH_HPP

#include "connectors/markdown/inline_sequence.hpp"
#include "plugins/latex_math.hpp"

namespace dans::document::connectors::markdown
{
class LatexMathDisplayMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto targets(const DocumentBlock& block) const
        -> std::vector<writers::MarkdownTargetDescriptor> override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;
};

class LatexMathInlineMarkdownAdapter final : public InlineMarkdownAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineMarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_LATEX_MATH_HPP
