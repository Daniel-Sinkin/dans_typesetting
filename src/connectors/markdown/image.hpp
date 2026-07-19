// src/connectors/markdown/image.hpp — connect semantic images to Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_IMAGE_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_IMAGE_HPP

#include "connectors/markdown/inline_sequence.hpp"
#include "plugins/image.hpp"

#include <memory>

namespace dans::document::connectors::markdown
{
class InlineImageMarkdownAdapter final : public InlineMarkdownAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineMarkdownOutput& output) const
        -> void override;
};

class FigureMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    explicit FigureMarkdownAdapter(std::shared_ptr<const InlineMarkdownRenderer> inline_renderer);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto targets(const DocumentBlock& block) const
        -> std::vector<writers::MarkdownTargetDescriptor> override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;

  private:
    std::shared_ptr<const InlineMarkdownRenderer> inline_renderer_{};
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_IMAGE_HPP
