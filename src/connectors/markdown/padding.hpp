// Deliberately flatten Padding when targeting portable Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_PADDING_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_PADDING_HPP

#include "plugins/padding.hpp"
#include "writers/markdown_writer.hpp"

#include <string_view>

namespace dans::document::connectors::markdown
{
class PaddingMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_PADDING_HPP
