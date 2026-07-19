// Lower block-bearing Grid cells through standard LaTeX tabular/minipage primitives.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_GRID_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_GRID_HPP

#include "plugins/grid.hpp"
#include "writers/latex_writer.hpp"

#include <string_view>

namespace dans::document::connectors::latex
{
class GridLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_GRID_HPP
