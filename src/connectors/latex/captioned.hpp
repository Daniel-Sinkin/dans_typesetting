// Lower generic string-keyed captions while delegating their single child.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_CAPTIONED_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_CAPTIONED_HPP

#include "connectors/latex/inline_sequence.hpp"
#include "plugins/captioned.hpp"
#include "writers/latex_writer.hpp"

#include <memory>
#include <string_view>

namespace dans::document::connectors::latex
{
class CaptionedLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    explicit CaptionedLatexAdapter(std::shared_ptr<const InlineLatexRenderer> inline_renderer);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;

  private:
    std::shared_ptr<const InlineLatexRenderer> inline_renderer_{};
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_CAPTIONED_HPP
