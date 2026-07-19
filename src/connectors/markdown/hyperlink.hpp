// src/connectors/markdown/hyperlink.hpp — connect semantic hyperlinks to Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_HYPERLINK_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_HYPERLINK_HPP

#include "connectors/markdown/core_paragraph.hpp"
#include "plugins/hyperlink.hpp"

namespace dans::document::connectors::markdown
{
class HyperlinkMarkdownAdapter final : public CoreParagraphInlineMarkdownAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_HYPERLINK_HPP
