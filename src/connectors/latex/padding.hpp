// Lower semantic Padding intent while delegating its nested content.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_PADDING_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_PADDING_HPP

#include "plugins/padding.hpp"
#include "writers/latex_writer.hpp"

#include <string_view>

namespace dans::document::connectors::latex
{
class PaddingLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_PADDING_HPP
