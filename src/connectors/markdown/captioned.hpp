// Portable Markdown rendering for generic captions and category numbering.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_CAPTIONED_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_CAPTIONED_HPP

#include "connectors/markdown/inline_sequence.hpp"
#include "plugins/captioned.hpp"
#include "writers/markdown_writer.hpp"

#include <memory>
#include <string_view>

namespace dans::document::connectors::markdown
{
class CaptionedMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    explicit CaptionedMarkdownAdapter(
        std::shared_ptr<const InlineMarkdownRenderer> inline_renderer
    );

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto targets(const DocumentBlock& block) const
        -> std::vector<writers::MarkdownTargetDescriptor> override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;

  private:
    std::shared_ptr<const InlineMarkdownRenderer> inline_renderer_{};
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_CAPTIONED_HPP
