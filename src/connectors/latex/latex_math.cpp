// src/connectors/latex/latex_math.cpp — lower LaTeX-authored math to LaTeX.
#include "connectors/latex/latex_math.hpp"

#include <stdexcept>

namespace dans::document::connectors::latex
{
auto LatexMathDisplayAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::LatexMathDisplay::k_type_id;
}

auto LatexMathDisplayAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    const auto* math = dynamic_cast<const plugins::LatexMathDisplay*>(&block);
    if (math == nullptr)
    {
        throw std::invalid_argument{
            "The LaTeX-authored display-math adapter received a different block type"
        };
    }

    const bool numbered = math->numbering() == plugins::LatexMathNumbering::numbered;
    output.write_raw(numbered ? "\\begin{equation}\n" : "\\[\n");
    output.write_raw(math->source());
    output.write_raw("\n");
    if (math->reference_id().has_value())
    {
        output.write_raw("\\label{");
        output.write_raw(math->reference_id()->value());
        output.write_raw("}\n");
    }
    output.write_raw(numbered ? "\\end{equation}\n\n" : "\\]\n\n");
}

auto LatexMathInlineAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::LatexMathInline::k_type_id;
}

auto LatexMathInlineAdapter::serialize(
    const plugins::InlineNode& node, InlineLatexOutput& output
) const -> void
{
    const auto* math = dynamic_cast<const plugins::LatexMathInline*>(&node);
    if (math == nullptr)
    {
        throw std::invalid_argument{
            "The LaTeX-authored inline-math adapter received a different inline type"
        };
    }
    output.write_raw("$");
    output.write_raw(math->source());
    output.write_raw("$");
}
}  // namespace dans::document::connectors::latex
