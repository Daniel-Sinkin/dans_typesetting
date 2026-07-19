// src/connectors/markdown/image.hpp — connect semantic images to Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_IMAGE_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_IMAGE_HPP

#include "connectors/markdown/core_paragraph.hpp"
#include "plugins/image.hpp"

#include <memory>

namespace dans::document::connectors::markdown
{
class InlineImageMarkdownAdapter final : public CoreParagraphInlineMarkdownAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output) const
        -> void override;
};

class FigureMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    explicit FigureMarkdownAdapter(
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

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_IMAGE_HPP
