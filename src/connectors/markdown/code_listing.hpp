// src/connectors/markdown/code_listing.hpp — connect source listings to Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_CODE_LISTING_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_CODE_LISTING_HPP

#include "connectors/markdown/core_paragraph.hpp"
#include "plugins/code_listing.hpp"

#include <memory>

namespace dans::document::connectors::markdown
{
class CodeListingMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    explicit CodeListingMarkdownAdapter(
        std::shared_ptr<const CoreParagraphInlineMarkdownRenderer> inline_renderer
    );

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto targets(const DocumentBlock& block) const
        -> std::vector<writers::MarkdownTargetDescriptor> override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;

  private:
    std::shared_ptr<const CoreParagraphInlineMarkdownRenderer> inline_renderer_{};
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_CODE_LISTING_HPP
