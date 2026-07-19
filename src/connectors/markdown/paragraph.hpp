// src/connectors/markdown/paragraph.hpp — connect text and paragraph plugins to Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_PARAGRAPH_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_PARAGRAPH_HPP

#include "connectors/markdown/inline_sequence.hpp"
#include "plugins/paragraph.hpp"

#include <memory>
#include <string_view>

namespace dans::document::connectors::markdown
{
class ParagraphMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    explicit ParagraphMarkdownAdapter(std::shared_ptr<const InlineMarkdownRenderer> renderer);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;

  private:
    std::shared_ptr<const InlineMarkdownRenderer> renderer_{};
};

class TextMarkdownAdapter final : public InlineMarkdownAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineMarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_PARAGRAPH_HPP
