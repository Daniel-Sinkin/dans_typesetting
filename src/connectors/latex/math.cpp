#include "connectors/latex/math.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>

namespace
{
using dans::document::plugins::Math;
using BinaryOperator = Math::BinaryOperator;

auto binary_precedence(const Math::BinaryOperator operation) -> int
{
    switch (operation)
    {
        case Math::BinaryOperator::equal:
            return 10;
        case Math::BinaryOperator::add:
        case Math::BinaryOperator::subtract:
            return 20;
        case Math::BinaryOperator::product:
        case Math::BinaryOperator::center_dot:
        case Math::BinaryOperator::times:
            return 30;
    }
    throw std::logic_error{"Unknown structured-math binary operator"};
}

template <typename Output>
auto write_identifier(Output& output, const std::string_view name) -> void
{
    if (name.size() == 1)
    {
        output.write_raw(name);
        return;
    }

    output.write_raw("\\mathit{");
    output.write_raw(name);
    output.write_raw("}");
}

template <typename Output>
auto write_symbol(Output& output, const Math::Symbol symbol) -> void
{
    switch (symbol)
    {
        case Math::Symbol::alpha:
            output.write_raw("\\alpha");
            return;
        case Math::Symbol::beta:
            output.write_raw("\\beta");
            return;
        case Math::Symbol::theta:
            output.write_raw("\\theta");
            return;
        case Math::Symbol::psi:
            output.write_raw("\\psi");
            return;
        case Math::Symbol::nabla:
            output.write_raw("\\nabla");
            return;
        case Math::Symbol::asterisk:
            output.write_raw("*");
            return;
    }
    throw std::logic_error{"Unknown structured-math symbol"};
}

template <typename Output>
auto write_open_delimiter(Output& output, const Math::Delimiter delimiter) -> void
{
    switch (delimiter)
    {
        case Math::Delimiter::parentheses:
            output.write_raw("\\left(");
            return;
        case Math::Delimiter::square:
            output.write_raw("\\left[");
            return;
        case Math::Delimiter::angle:
            output.write_raw("\\left\\langle ");
            return;
    }
    throw std::logic_error{"Unknown structured-math delimiter"};
}

template <typename Output>
auto write_close_delimiter(Output& output, const Math::Delimiter delimiter) -> void
{
    switch (delimiter)
    {
        case Math::Delimiter::parentheses:
            output.write_raw("\\right)");
            return;
        case Math::Delimiter::square:
            output.write_raw("\\right]");
            return;
        case Math::Delimiter::angle:
            output.write_raw(" \\right\\rangle");
            return;
    }
    throw std::logic_error{"Unknown structured-math delimiter"};
}

template <typename Output>
auto write_expression(
    const Math& expression,
    Output& output,
    const int parent_precedence = 0,
    const bool align_top_level_equality = false
) -> void
{
    using Kind = Math::Kind;

    switch (expression.kind())
    {
        case Kind::integer:
            output.write_raw(std::to_string(expression.integer_value()));
            return;
        case Kind::identifier:
            write_identifier(output, expression.identifier_name());
            return;
        case Kind::symbol:
            write_symbol(output, expression.symbol_value());
            return;
        case Kind::binary:
            {
                const auto& binary = expression.binary_expression();
                const auto operation = binary.operation;
                const auto precedence = binary_precedence(operation);
                const bool needs_parentheses = precedence < parent_precedence;
                const bool align_at_operator =
                    binary.align_at_operator
                    || (align_top_level_equality && operation == BinaryOperator::equal);
                if (needs_parentheses)
                {
                    output.write_raw("\\left(");
                }

                write_expression(binary.left, output, precedence);
                switch (operation)
                {
                    case BinaryOperator::add:
                        output.write_raw(align_at_operator ? " &+ " : " + ");
                        break;
                    case BinaryOperator::subtract:
                        output.write_raw(align_at_operator ? " &- " : " - ");
                        break;
                    case BinaryOperator::equal:
                        output.write_raw(align_at_operator ? " &= " : " = ");
                        break;
                    case BinaryOperator::product:
                        output.write_raw(align_at_operator ? " &* " : " * ");
                        break;
                    case BinaryOperator::center_dot:
                        output.write_raw(align_at_operator ? " &\\cdot " : " \\cdot ");
                        break;
                    case BinaryOperator::times:
                        output.write_raw(align_at_operator ? " &\\times " : " \\times ");
                        break;
                }
                const auto right_precedence =
                    operation == BinaryOperator::subtract ? precedence + 1 : precedence;
                write_expression(binary.right, output, right_precedence);

                if (needs_parentheses)
                {
                    output.write_raw("\\right)");
                }
                return;
            }
        case Kind::script:
            output.write_raw("{");
            write_expression(expression.script_base(), output, 100);
            output.write_raw("}");
            if (const auto* subscript = expression.script_subscript(); subscript != nullptr)
            {
                output.write_raw("_{");
                write_expression(*subscript, output);
                output.write_raw("}");
            }
            if (const auto* superscript = expression.script_superscript(); superscript != nullptr)
            {
                output.write_raw("^{");
                write_expression(*superscript, output);
                output.write_raw("}");
            }
            return;
        case Kind::sequence:
            {
                constexpr int k_sequence_precedence = 30;
                const bool needs_parentheses = k_sequence_precedence < parent_precedence;
                if (needs_parentheses)
                {
                    output.write_raw("\\left(");
                }
                for (const auto& item : expression.items())
                {
                    write_expression(item, output, k_sequence_precedence);
                }
                if (needs_parentheses)
                {
                    output.write_raw("\\right)");
                }
                return;
            }
        case Kind::function:
            {
                if (expression.function_is_named_operator())
                {
                    output.write_raw("\\operatorname{");
                    output.write_raw(expression.function_name());
                    output.write_raw("}");
                }
                else
                {
                    write_identifier(output, expression.function_name());
                }
                output.write_raw("\\!");
                write_open_delimiter(output, expression.function_delimiter());
                write_expression(*expression.function_argument(), output);
                write_close_delimiter(output, expression.function_delimiter());
                return;
            }
        case Kind::delimited:
            write_open_delimiter(output, expression.delimited_style());
            write_expression(*expression.delimited_body(), output);
            write_close_delimiter(output, expression.delimited_style());
            return;
        case Kind::inner_product:
            {
                output.write_raw("\\left\\langle ");
                bool first = true;
                for (const auto& term : expression.items())
                {
                    if (!first)
                    {
                        output.write_raw(" \\middle| ");
                    }
                    write_expression(term, output);
                    first = false;
                }
                output.write_raw(" \\right\\rangle");
                return;
            }
        case Kind::summation:
            output.write_raw("\\sum");
            if (const auto* lower = expression.summation_lower(); lower != nullptr)
            {
                output.write_raw("_{");
                write_expression(*lower, output);
                output.write_raw("}");
            }
            if (const auto* upper = expression.summation_upper(); upper != nullptr)
            {
                output.write_raw("^{");
                write_expression(*upper, output);
                output.write_raw("}");
            }
            output.write_raw(" ");
            write_expression(*expression.summation_body(), output, 30);
            return;
    }
    throw std::logic_error{"Unknown structured-math expression kind"};
}
}  // namespace

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
        write_expression(line.expression, output);
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
        lines, [](const Math::DisplayLine& line) { return line.reference_id.has_value(); }
    );
    const bool aligned = math->options().alignment == Math::DisplayAlignment::automatic;
    output.write_raw("\\begin{");
    output.write_raw(aligned ? "align" : "gather");
    output.write_raw(numbered ? "}\n" : "*}\n");
    for (usize index = 0; index < lines.size(); ++index)
    {
        const auto& line = lines[index];
        write_expression(line.expression, output, 0, aligned && !has_explicit_alignment);
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
    write_expression(math->expression(), output);
    output.write_raw("\\)");
}
}  // namespace dans::document::connectors::latex
