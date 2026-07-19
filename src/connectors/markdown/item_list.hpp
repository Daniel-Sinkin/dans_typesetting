// src/connectors/markdown/item_list.hpp — connect semantic lists to Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_ITEM_LIST_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_ITEM_LIST_HPP

#include "connectors/markdown/core_paragraph.hpp"
#include "plugins/item_list.hpp"

#include <memory>

namespace dans::document::connectors::markdown
{
class ItemListMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    explicit ItemListMarkdownAdapter(
        std::shared_ptr<const CoreParagraphInlineMarkdownRenderer> inline_renderer
    );

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;

  private:
    std::shared_ptr<const CoreParagraphInlineMarkdownRenderer> inline_renderer_{};
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_ITEM_LIST_HPP
