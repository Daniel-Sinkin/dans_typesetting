// src/connectors/latex/code_listing.hpp — declare LaTeX rendering for code listings.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_CODE_LISTING_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_CODE_LISTING_HPP

#include "connectors/latex/inline_sequence.hpp"
#include "plugins/code_listing.hpp"

#include <memory>
#include <string_view>

namespace dans::document::connectors::latex
{
class CodeListingLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    explicit CodeListingLatexAdapter(std::shared_ptr<const InlineLatexRenderer> inline_renderer);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;

  private:
    std::shared_ptr<const InlineLatexRenderer> inline_renderer_{};
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_CODE_LISTING_HPP
