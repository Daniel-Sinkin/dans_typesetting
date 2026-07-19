// src/connectors/markdown/inline_code.hpp — connect semantic inline code to Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_INLINE_CODE_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_INLINE_CODE_HPP

#include "connectors/markdown/inline_sequence.hpp"
#include "plugins/inline_code.hpp"

namespace dans::document::connectors::markdown
{
class InlineCodeMarkdownAdapter final : public InlineMarkdownAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineMarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_INLINE_CODE_HPP
