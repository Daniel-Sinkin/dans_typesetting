// src/connectors/markdown/table.hpp — connect rectangular rich tables to GFM Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_TABLE_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_TABLE_HPP

#include "connectors/markdown/inline_sequence.hpp"
#include "plugins/table.hpp"

#include <memory>

namespace dans::document::connectors::markdown
{
class TableMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    explicit TableMarkdownAdapter(std::shared_ptr<const InlineMarkdownRenderer> inline_renderer);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto targets(const DocumentBlock& block) const
        -> std::vector<writers::MarkdownTargetDescriptor> override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;

  private:
    std::shared_ptr<const InlineMarkdownRenderer> inline_renderer_{};
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_TABLE_HPP
