// src/plugins/latex_math.hpp — define deliberately LaTeX-authored math nodes.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_LATEX_MATH_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_LATEX_MATH_HPP

#include "document.hpp"
#include "plugins/inline_sequence.hpp"
#include "reference_id.hpp"

#include <optional>
#include <string>
#include <string_view>

namespace dans::document::plugins
{
enum class LatexMathNumbering : u8
{
    numbered,
    unnumbered,
};

// A scoped escape hatch containing only the source that belongs inside math
// delimiters. The delimiters themselves remain writer-owned.
class LatexMathInline final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.math.latex.inline";

    explicit LatexMathInline(std::string_view source);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto source() const noexcept -> std::string_view;

  private:
    std::string source_{};
};

class LatexMathDisplay final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.math.latex.display";

    explicit LatexMathDisplay(
        std::string_view source,
        LatexMathNumbering numbering = LatexMathNumbering::numbered,
        std::optional<ReferenceId> reference_id = std::nullopt
    );

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto source() const noexcept -> std::string_view;
    [[nodiscard]] auto numbering() const noexcept -> LatexMathNumbering;
    [[nodiscard]] auto reference_id() const noexcept -> const std::optional<ReferenceId>&;

  private:
    std::string source_{};
    LatexMathNumbering numbering_{};
    std::optional<ReferenceId> reference_id_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_LATEX_MATH_HPP
