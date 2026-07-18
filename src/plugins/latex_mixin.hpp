#ifndef DANS_TYPESETTING_SRC_PLUGINS_LATEX_MIXIN_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_LATEX_MIXIN_HPP

#include "plugins/core_paragraph.hpp"

#include <string>
#include <string_view>

namespace dans::document::plugins
{
// Deliberate one-way escape hatches. These nodes are supported only by the
// LaTeX exporter and make no claim of portability to another backend.
class LatexBlock final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.latex.block";

    explicit LatexBlock(std::string_view source);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto source() const noexcept -> std::string_view;

  private:
    std::string source_{};
};

class InlineLatex final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.latex.inline";

    explicit InlineLatex(std::string_view source);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto source() const noexcept -> std::string_view;

  private:
    std::string source_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_LATEX_MIXIN_HPP
