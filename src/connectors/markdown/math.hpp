// src/connectors/markdown/math.hpp — connect structured math to Markdown math syntax.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_MATH_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_MATH_HPP

#include "connectors/markdown/inline_sequence.hpp"
#include "plugins/math.hpp"

namespace dans::document::connectors::markdown
{
class DisplayMathMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto targets(const DocumentBlock& block) const
        -> std::vector<writers::MarkdownTargetDescriptor> override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;
};

class InlineMathMarkdownAdapter final : public InlineMarkdownAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineMarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_MATH_HPP
