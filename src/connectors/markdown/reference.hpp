// src/connectors/markdown/reference.hpp — connect semantic cross references to Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_REFERENCE_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_REFERENCE_HPP

#include "connectors/markdown/core_paragraph.hpp"
#include "plugins/reference.hpp"

namespace dans::document::connectors::markdown
{
class ReferenceMarkdownAdapter final : public CoreParagraphInlineMarkdownAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_REFERENCE_HPP
