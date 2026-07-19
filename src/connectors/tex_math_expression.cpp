// src/connectors/tex_math_expression.cpp — lower structured math to shared TeX notation.
#include "connectors/tex_math_expression.hpp"

#include <sstream>
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
        case Math::BinaryOperator::right_arrow:
        case Math::BinaryOperator::maps_to:
            return 5;
        case Math::BinaryOperator::equal:
        case Math::BinaryOperator::not_equal:
        case Math::BinaryOperator::less_than:
        case Math::BinaryOperator::less_equal:
        case Math::BinaryOperator::greater_than:
        case Math::BinaryOperator::greater_equal:
        case Math::BinaryOperator::approximately_equal:
        case Math::BinaryOperator::similar:
        case Math::BinaryOperator::element_of:
            return 10;
        case Math::BinaryOperator::add:
        case Math::BinaryOperator::subtract:
            return 20;
        case Math::BinaryOperator::product:
        case Math::BinaryOperator::center_dot:
        case Math::BinaryOperator::times:
        case Math::BinaryOperator::divide:
        case Math::BinaryOperator::tensor_product:
            return 30;
    }
    throw std::logic_error{"Unknown structured-math binary operator"};
}

template <typename Output>
auto write_identifier(
    Output& output,
    const std::string_view name,
    const Math::IdentifierStyle style = Math::IdentifierStyle::italic
) -> void
{
    switch (style)
    {
        case Math::IdentifierStyle::italic:
            if (name.size() == 1)
            {
                output.write_raw(name);
                return;
            }
            output.write_raw("\\mathit{");
            output.write_raw(name);
            output.write_raw("}");
            return;
        case Math::IdentifierStyle::blackboard:
            output.write_raw("\\mathbb{");
            output.write_raw(name);
            output.write_raw("}");
            return;
        case Math::IdentifierStyle::calligraphic:
            output.write_raw("\\mathcal{");
            output.write_raw(name);
            output.write_raw("}");
            return;
    }
    throw std::logic_error{"Unknown math identifier style"};
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
        case Math::Symbol::gamma:
            output.write_raw("\\gamma");
            return;
        case Math::Symbol::delta:
            output.write_raw("\\delta");
            return;
        case Math::Symbol::epsilon:
            output.write_raw("\\epsilon");
            return;
        case Math::Symbol::zeta:
            output.write_raw("\\zeta");
            return;
        case Math::Symbol::eta:
            output.write_raw("\\eta");
            return;
        case Math::Symbol::theta:
            output.write_raw("\\theta");
            return;
        case Math::Symbol::iota:
            output.write_raw("\\iota");
            return;
        case Math::Symbol::kappa:
            output.write_raw("\\kappa");
            return;
        case Math::Symbol::lambda:
            output.write_raw("\\lambda");
            return;
        case Math::Symbol::mu:
            output.write_raw("\\mu");
            return;
        case Math::Symbol::nu:
            output.write_raw("\\nu");
            return;
        case Math::Symbol::xi:
            output.write_raw("\\xi");
            return;
        case Math::Symbol::omicron:
            output.write_raw("o");
            return;
        case Math::Symbol::pi:
            output.write_raw("\\pi");
            return;
        case Math::Symbol::rho:
            output.write_raw("\\rho");
            return;
        case Math::Symbol::sigma:
            output.write_raw("\\sigma");
            return;
        case Math::Symbol::tau:
            output.write_raw("\\tau");
            return;
        case Math::Symbol::upsilon:
            output.write_raw("\\upsilon");
            return;
        case Math::Symbol::phi:
            output.write_raw("\\phi");
            return;
        case Math::Symbol::chi:
            output.write_raw("\\chi");
            return;
        case Math::Symbol::psi:
            output.write_raw("\\psi");
            return;
        case Math::Symbol::omega:
            output.write_raw("\\omega");
            return;
        case Math::Symbol::capital_alpha:
            output.write_raw("A");
            return;
        case Math::Symbol::capital_beta:
            output.write_raw("B");
            return;
        case Math::Symbol::capital_gamma:
            output.write_raw("\\Gamma");
            return;
        case Math::Symbol::capital_delta:
            output.write_raw("\\Delta");
            return;
        case Math::Symbol::capital_epsilon:
            output.write_raw("E");
            return;
        case Math::Symbol::capital_zeta:
            output.write_raw("Z");
            return;
        case Math::Symbol::capital_eta:
            output.write_raw("H");
            return;
        case Math::Symbol::capital_theta:
            output.write_raw("\\Theta");
            return;
        case Math::Symbol::capital_iota:
            output.write_raw("I");
            return;
        case Math::Symbol::capital_kappa:
            output.write_raw("K");
            return;
        case Math::Symbol::capital_lambda:
            output.write_raw("\\Lambda");
            return;
        case Math::Symbol::capital_mu:
            output.write_raw("M");
            return;
        case Math::Symbol::capital_nu:
            output.write_raw("N");
            return;
        case Math::Symbol::capital_xi:
            output.write_raw("\\Xi");
            return;
        case Math::Symbol::capital_omicron:
            output.write_raw("O");
            return;
        case Math::Symbol::capital_pi:
            output.write_raw("\\Pi");
            return;
        case Math::Symbol::capital_rho:
            output.write_raw("P");
            return;
        case Math::Symbol::capital_sigma:
            output.write_raw("\\Sigma");
            return;
        case Math::Symbol::capital_tau:
            output.write_raw("T");
            return;
        case Math::Symbol::capital_upsilon:
            output.write_raw("\\Upsilon");
            return;
        case Math::Symbol::capital_phi:
            output.write_raw("\\Phi");
            return;
        case Math::Symbol::capital_chi:
            output.write_raw("X");
            return;
        case Math::Symbol::capital_psi:
            output.write_raw("\\Psi");
            return;
        case Math::Symbol::capital_omega:
            output.write_raw("\\Omega");
            return;
        case Math::Symbol::nabla:
            output.write_raw("\\nabla");
            return;
        case Math::Symbol::partial:
            output.write_raw("\\partial");
            return;
        case Math::Symbol::infinity:
            output.write_raw("\\infty");
            return;
        case Math::Symbol::ellipsis:
            output.write_raw("\\dots");
            return;
        case Math::Symbol::centered_ellipsis:
            output.write_raw("\\cdots");
            return;
        case Math::Symbol::dagger:
            output.write_raw("\\dagger");
            return;
        case Math::Symbol::transpose:
            output.write_raw("\\top");
            return;
        case Math::Symbol::script_ell:
            output.write_raw("\\ell");
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
            write_identifier(output, expression.identifier_name(), expression.identifier_style());
            return;
        case Kind::symbol:
            output.write_raw("{");
            write_symbol(output, expression.symbol_value());
            output.write_raw("}");
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
                    case BinaryOperator::not_equal:
                        output.write_raw(align_at_operator ? " &\\neq " : " \\neq ");
                        break;
                    case BinaryOperator::less_than:
                        output.write_raw(align_at_operator ? " &< " : " < ");
                        break;
                    case BinaryOperator::less_equal:
                        output.write_raw(align_at_operator ? " &\\leq " : " \\leq ");
                        break;
                    case BinaryOperator::greater_than:
                        output.write_raw(align_at_operator ? " &> " : " > ");
                        break;
                    case BinaryOperator::greater_equal:
                        output.write_raw(align_at_operator ? " &\\geq " : " \\geq ");
                        break;
                    case BinaryOperator::approximately_equal:
                        output.write_raw(align_at_operator ? " &\\approx " : " \\approx ");
                        break;
                    case BinaryOperator::similar:
                        output.write_raw(align_at_operator ? " &\\sim " : " \\sim ");
                        break;
                    case BinaryOperator::element_of:
                        output.write_raw(align_at_operator ? " &\\in " : " \\in ");
                        break;
                    case BinaryOperator::right_arrow:
                        output.write_raw(align_at_operator ? " &\\to " : " \\to ");
                        break;
                    case BinaryOperator::maps_to:
                        output.write_raw(align_at_operator ? " &\\mapsto " : " \\mapsto ");
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
                    case BinaryOperator::divide:
                        output.write_raw(align_at_operator ? " &/ " : " / ");
                        break;
                    case BinaryOperator::tensor_product:
                        output.write_raw(align_at_operator ? " &\\otimes " : " \\otimes ");
                        break;
                }
                const auto right_precedence =
                    operation == BinaryOperator::subtract || operation == BinaryOperator::divide
                        ? precedence + 1
                        : precedence;
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
        case Kind::fraction:
            output.write_raw("\\frac{");
            write_expression(expression.fraction_numerator(), output);
            output.write_raw("}{");
            write_expression(expression.fraction_denominator(), output);
            output.write_raw("}");
            return;
        case Kind::radical:
            output.write_raw("\\sqrt");
            if (const auto* degree = expression.radical_degree(); degree != nullptr)
            {
                output.write_raw("[");
                write_expression(*degree, output);
                output.write_raw("]");
            }
            output.write_raw("{");
            write_expression(expression.radical_radicand(), output);
            output.write_raw("}");
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
        case Kind::comma_separated:
            {
                bool first = true;
                for (const auto& item : expression.items())
                {
                    if (!first)
                    {
                        output.write_raw(", ");
                    }
                    write_expression(item, output);
                    first = false;
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
        case Kind::grid:
            output.write_raw("\\begin{matrix}");
            for (dans::usize row = 0; row < expression.grid_rows(); ++row)
            {
                if (row != dans::usize{0})
                {
                    output.write_raw(" \\\\ ");
                }
                for (dans::usize column = 0; column < expression.grid_columns(); ++column)
                {
                    if (column != dans::usize{0})
                    {
                        output.write_raw(" & ");
                    }
                    const auto index = row * expression.grid_columns() + column;
                    write_expression(expression.grid_cells()[index], output);
                }
            }
            output.write_raw("\\end{matrix}");
            return;
    }
    throw std::logic_error{"Unknown structured-math expression kind"};
}
}  // namespace

namespace dans::document::connectors::tex
{
namespace
{
class StringOutput final
{
  public:
    auto write_raw(const std::string_view text) -> void
    {
        output_ << text;
    }

    [[nodiscard]] auto str() const -> std::string
    {
        return output_.str();
    }

  private:
    std::ostringstream output_{};
};
}  // namespace

auto render_expression(const plugins::Math& expression, const RenderOptions options) -> std::string
{
    StringOutput output{};
    write_expression(expression, output, 0, options.align_top_level_equality);
    return output.str();
}
}  // namespace dans::document::connectors::tex
