// Preserve Grid content in row-major order when Markdown cannot express its layout.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_GRID_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_GRID_HPP

#include "plugins/grid.hpp"
#include "writers/markdown_writer.hpp"

#include <string_view>

namespace dans::document::connectors::markdown
{
class GridMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_GRID_HPP
