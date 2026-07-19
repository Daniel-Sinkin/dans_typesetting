// LaTeX connector for the semantic item-list plugin.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_ITEM_LIST_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_ITEM_LIST_HPP

#include "connectors/latex/core_paragraph.hpp"
#include "plugins/item_list.hpp"
#include "writers/latex_writer.hpp"

#include <memory>
#include <string_view>

namespace dans::document::connectors::latex
{
class ItemListLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    explicit ItemListLatexAdapter(
        std::shared_ptr<const CoreParagraphInlineLatexRenderer> inline_renderer
    );

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;

  private:
    std::shared_ptr<const CoreParagraphInlineLatexRenderer> inline_renderer_{};
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_ITEM_LIST_HPP
