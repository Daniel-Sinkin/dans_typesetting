// LaTeX connector for the semantic rich-table plugin.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_TABLE_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_TABLE_HPP

#include "connectors/latex/inline_sequence.hpp"
#include "plugins/table.hpp"
#include "writers/latex_writer.hpp"

#include <memory>
#include <string_view>

namespace dans::document::connectors::latex
{
class TableLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    explicit TableLatexAdapter(std::shared_ptr<const InlineLatexRenderer> inline_renderer);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;

  private:
    std::shared_ptr<const InlineLatexRenderer> inline_renderer_{};
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_TABLE_HPP
