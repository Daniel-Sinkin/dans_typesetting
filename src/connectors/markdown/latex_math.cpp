// src/connectors/markdown/latex_math.cpp — lower LaTeX-authored math to Markdown math.
#include "connectors/markdown/latex_math.hpp"

#include <stdexcept>

namespace dans::document::connectors::markdown
{
auto LatexMathDisplayMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::LatexMathDisplay::k_type_id;
}

auto LatexMathDisplayMarkdownAdapter::targets(const DocumentBlock& block) const
    -> std::vector<writers::MarkdownTargetDescriptor>
{
    const auto* math = dynamic_cast<const plugins::LatexMathDisplay*>(&block);
    if (math == nullptr)
    {
        throw std::invalid_argument{
            "The LaTeX-authored display-math adapter received a different block type"
        };
    }
    if (math->numbering() == plugins::LatexMathNumbering::unnumbered)
    {
        return {};
    }
    return {writers::MarkdownTargetDescriptor{
        .reference_id = math->reference_id().has_value() ? &*math->reference_id() : nullptr,
        .label = "Equation",
        .numbering_series = "equation",
    }};
}

auto LatexMathDisplayMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* math = dynamic_cast<const plugins::LatexMathDisplay*>(&block);
    if (math == nullptr)
    {
        throw std::invalid_argument{
            "The LaTeX-authored display-math adapter received a different block type"
        };
    }
    if (math->reference_id().has_value())
    {
        output.write_anchor(*math->reference_id());
    }
    output.write_raw("$$\n");
    output.write_raw(math->source());
    output.write_raw("\n$$\n");
    if (math->numbering() == plugins::LatexMathNumbering::numbered)
    {
        output.write_raw("\n*Equation ");
        output.write_raw(output.target_number(block));
        output.write_raw("*\n");
    }
    output.write_raw("\n");
}

auto LatexMathInlineMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::LatexMathInline::k_type_id;
}

auto LatexMathInlineMarkdownAdapter::serialize(
    const plugins::InlineNode& node, InlineMarkdownOutput& output
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
}  // namespace dans::document::connectors::markdown
