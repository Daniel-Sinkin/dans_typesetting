// src/connectors/markdown/math.cpp — emit TeX-compatible inline and display math spans.
#include "connectors/markdown/math.hpp"

#include "connectors/tex_math_expression.hpp"

#include <stdexcept>

namespace dans::document::connectors::markdown
{
auto DisplayMathMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Math::Display::k_type_id;
}

auto DisplayMathMarkdownAdapter::targets(const DocumentBlock& block) const
    -> std::vector<writers::MarkdownTargetDescriptor>
{
    const auto* display = dynamic_cast<const plugins::Math::Display*>(&block);
    if (display == nullptr)
    {
        throw std::invalid_argument{
            "The structured display-math adapter received a different block type"
        };
    }
    std::vector<writers::MarkdownTargetDescriptor> targets{};
    for (const auto& line : display->lines())
    {
        if (line.reference_id.has_value())
        {
            targets.push_back(
                writers::MarkdownTargetDescriptor{
                    .reference_id = &*line.reference_id,
                    .label = "Equation",
                    .numbering_series = "equation",
                }
            );
        }
    }
    return targets;
}

auto DisplayMathMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* display = dynamic_cast<const plugins::Math::Display*>(&block);
    if (display == nullptr)
    {
        throw std::invalid_argument{
            "The structured display-math adapter received a different block type"
        };
    }
    for (const auto& line : display->lines())
    {
        if (line.reference_id.has_value())
        {
            output.write_anchor(*line.reference_id);
        }
        output.write_raw("$$\n");
        const bool has_explicit_alignment = line.expression.explicit_alignment_points() != usize{0};
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
        output.write_raw("$$\n");
        if (line.reference_id.has_value())
        {
            output.write_raw("\n*Equation ");
            output.write_raw(output.target_number(*line.reference_id));
            output.write_raw("*\n");
        }
        output.write_raw("\n");
    }
}

auto InlineMathMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Math::Inline::k_type_id;
}

auto InlineMathMarkdownAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output
) const -> void
{
    const auto* math = dynamic_cast<const plugins::Math::Inline*>(&node);
    if (math == nullptr)
    {
        throw std::invalid_argument{
            "The structured inline-math adapter received a different inline type"
        };
    }
    if (math->expression().explicit_alignment_points() != usize{0})
    {
        throw std::invalid_argument{"Inline Markdown math cannot contain alignment points"};
    }
    output.write_raw("$");
    output.write_raw(tex::render_expression(math->expression()));
    output.write_raw("$");
}
}  // namespace dans::document::connectors::markdown
