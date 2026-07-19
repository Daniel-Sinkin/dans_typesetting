// src/connectors/latex/math.cpp — render structured math blocks and inlines as LaTeX.
#include "connectors/latex/math.hpp"

#include "connectors/tex_math_expression.hpp"

#include <algorithm>
#include <stdexcept>

namespace dans::document::connectors::latex
{
auto DisplayMathLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Math::Display::k_type_id;
}

auto DisplayMathLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    const auto* math = dynamic_cast<const plugins::Math::Display*>(&block);
    if (math == nullptr)
    {
        throw std::invalid_argument{
            "The structured display-math adapter received a different block type"
        };
    }

    const auto lines = math->lines();
    const bool has_explicit_alignment =
        lines.front().expression.explicit_alignment_points() != usize{0};

    if (lines.size() == usize{1})
    {
        const auto& line = lines.front();
        const bool numbered = line.reference_id.has_value();
        output.write_raw(numbered ? "\\begin{equation}\n" : "\\[\n");
        if (has_explicit_alignment)
        {
            output.write_raw("\\begin{aligned}\n");
        }
        output.write_raw(tex::render_expression(line.expression));
        output.write_raw("\n");
        if (has_explicit_alignment)
        {
            output.write_raw("\\end{aligned}\n");
        }
        if (line.reference_id.has_value())
        {
            output.write_raw("\\label{");
            output.write_raw(line.reference_id->value());
            output.write_raw("}\n");
        }
        output.write_raw(numbered ? "\\end{equation}\n\n" : "\\]\n\n");
        return;
    }

    const bool numbered = std::ranges::any_of(
        lines, [](const plugins::Math::DisplayLine& line) { return line.reference_id.has_value(); }
    );
    const bool aligned = math->options().alignment == plugins::Math::DisplayAlignment::automatic;
    output.write_raw("\\begin{");
    output.write_raw(aligned ? "align" : "gather");
    output.write_raw(numbered ? "}\n" : "*}\n");
    for (usize index = 0; index < lines.size(); ++index)
    {
        const auto& line = lines[index];
        output.write_raw(
            tex::render_expression(
                line.expression,
                tex::RenderOptions{
                    .align_top_level_equality = aligned && !has_explicit_alignment,
                }
            )
        );
        if (line.reference_id.has_value())
        {
            output.write_raw(" \\label{");
            output.write_raw(line.reference_id->value());
            output.write_raw("}");
        }
        else if (numbered)
        {
            output.write_raw(" \\notag");
        }
        output.write_raw(index + usize{1} == lines.size() ? "\n" : " \\\\\n");
    }
    output.write_raw("\\end{");
    output.write_raw(aligned ? "align" : "gather");
    output.write_raw(numbered ? "}\n\n" : "*}\n\n");
}

auto InlineMathLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Math::Inline::k_type_id;
}

auto InlineMathLatexAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphLatexOutput& output
) const -> void
{
    const auto* math = dynamic_cast<const plugins::Math::Inline*>(&node);
    if (math == nullptr)
    {
        throw std::invalid_argument{
            "The structured inline-math adapter received a different inline type"
        };
    }

    output.write_raw("\\(");
    output.write_raw(tex::render_expression(math->expression()));
    output.write_raw("\\)");
}
}  // namespace dans::document::connectors::latex
