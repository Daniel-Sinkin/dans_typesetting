// Verify structured fractions, radicals, and scripts in the native math model.
#include "connectors/latex/math.hpp"
#include "connectors/tex_math_expression.hpp"
#include "document.hpp"
#include "plugins/math.hpp"
#include "writers/latex_writer.hpp"

#include <exception>
#include <memory>
#include <print>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>

namespace
{
using dans::document::Document;
using dans::document::connectors::latex::DisplayMathLatexAdapter;
using dans::document::plugins::Math;
using dans::document::writers::LatexWriter;

auto expect(const bool condition, const std::string_view message) -> void
{
    if (!condition)
    {
        throw std::runtime_error{std::string{message}};
    }
}

template <typename Operation>
auto expect_invalid_argument(Operation&& operation, const std::string_view message) -> void
{
    auto rejected = false;
    try
    {
        operation();
    }
    catch (const std::invalid_argument&)
    {
        rejected = true;
    }
    expect(rejected, message);
}

auto make_expression() -> Math
{
    using M = Math;
    return M::equal(
        M::fraction(M::id_x.subscript(M::id_i), M::square_root(M::id_y)),
        M::nth_root(M::id_3, M::id_z).superscript(M::id_2)
    );
}

auto test_model() -> void
{
    using M = Math;
    auto fraction = M::fraction(M::id_a, M::id_b);
    expect(fraction.kind() == M::Kind::fraction, "A fraction lost its expression kind");
    expect(fraction.fraction_numerator().identifier_name() == "a", "A fraction lost its numerator");
    expect(
        fraction.fraction_denominator().identifier_name() == "b", "A fraction lost its denominator"
    );

    auto square_root = M::square_root(M::id_x);
    expect(square_root.kind() == M::Kind::radical, "A square root lost its expression kind");
    expect(square_root.radical_degree() == nullptr, "A square root acquired a degree");

    auto cube_root = M::nth_root(M::id_3, M::id_x);
    expect(cube_root.radical_degree() != nullptr, "An indexed root lost its degree");
    expect(
        cube_root.radical_degree()->integer_literal() == "3", "An indexed root changed its degree"
    );

    auto scripted = M::id_A.subscript(M::id_i).superscript(M::id_2);
    expect(scripted.kind() == M::Kind::script, "A combined script lost its expression kind");
    expect(scripted.script_subscript() != nullptr, "A combined script lost its subscript");
    expect(scripted.script_superscript() != nullptr, "A combined script lost its superscript");

    auto blackboard = M::blackboard("C");
    expect(
        blackboard.identifier_style() == M::IdentifierStyle::blackboard,
        "A blackboard identifier lost its presentation style"
    );
    auto calligraphic = M::calligraphic("H");
    expect(
        calligraphic.identifier_style() == M::IdentifierStyle::calligraphic,
        "A calligraphic identifier lost its presentation style"
    );
    auto upright = M::upright("SIMD32");
    expect(
        upright.identifier_style() == M::IdentifierStyle::upright,
        "An upright identifier lost its presentation style"
    );
    auto annotation = M::underbrace(M::id_2, M::text("FMA & SIMD"));
    expect(annotation.kind() == M::Kind::underbrace, "An underbrace lost its expression kind");
    expect(annotation.underbrace_body().integer_literal() == "2", "An underbrace lost its body");
    expect(
        annotation.underbrace_annotation().text_value() == "FMA & SIMD",
        "An underbrace lost its annotation"
    );
    annotation.validate();

    bool rejected_control_text{};
    try
    {
        static_cast<void>(M::text("line\nbreak"));
    }
    catch (const std::invalid_argument&)
    {
        rejected_control_text = true;
    }
    expect(rejected_control_text, "Math text accepted a line break");

    make_expression().validate();
}

auto test_latex() -> void
{
    Document document;
    document.blocks().add<Math::Display>(make_expression());

    LatexWriter writer;
    writer.register_block_adapter(std::make_unique<DisplayMathLatexAdapter>());
    std::ostringstream output;
    writer.serialize(document, output);
    const auto rendered = output.str();

    expect(rendered.contains(R"(\usepackage{amsfonts})"), "Math alphabets omitted amsfonts");
    expect(
        rendered.contains(R"(\frac{{x}_{i}}{\sqrt{y}})"),
        "A structured fraction or its nested square root was not lowered to LaTeX"
    );
    expect(
        rendered.contains(R"({\sqrt[3]{z}}^{2})"),
        "An indexed root or its superscript was not lowered to LaTeX"
    );
}

auto test_numeric_literals_and_negation() -> void
{
    using M = Math;
    namespace tex = dans::document::connectors::tex;

    auto padded_integer = M::integer("00042");
    expect(
        padded_integer.integer_literal() == "00042", "An integer literal lost its source spelling"
    );
    auto large_integer = M::integer("1844674407370955161600");
    expect(
        large_integer.integer_literal() == "1844674407370955161600",
        "An integer literal was constrained to a machine integer"
    );
    auto decimal = M::decimal("003.20");
    expect(decimal.kind() == M::Kind::decimal, "A decimal lost its expression kind");
    expect(decimal.decimal_literal() == "003.20", "A decimal literal lost its source spelling");
    expect(M::decimal(".25").decimal_literal() == ".25", "A leading-dot decimal was changed");
    expect(M::decimal("3.").decimal_literal() == "3.", "A trailing-dot decimal was changed");

    auto negative = M::negate(M::decimal("056.321"));
    expect(negative.kind() == M::Kind::negated, "Unary negation lost its expression kind");
    expect(
        negative.negated_body().decimal_literal() == "056.321", "Unary negation changed its operand"
    );
    negative.validate();

    expect_invalid_argument(
        [] { static_cast<void>(M::integer("")); }, "An empty integer literal was accepted"
    );
    expect_invalid_argument(
        [] { static_cast<void>(M::integer("-3")); }, "An integer literal embedded a unary sign"
    );
    expect_invalid_argument(
        [] { static_cast<void>(M::integer(-3)); }, "A signed integer bypassed structural negation"
    );
    expect_invalid_argument(
        [] { static_cast<void>(M::decimal(".")); }, "A decimal without digits was accepted"
    );
    expect_invalid_argument(
        [] { static_cast<void>(M::decimal("-3.2")); }, "A decimal literal embedded a unary sign"
    );
    expect_invalid_argument(
        [] { static_cast<void>(M::decimal("1e3")); }, "Exponent notation was accepted as a decimal"
    );
    expect_invalid_argument(
        [] { static_cast<void>(M::decimal("3.2.1")); },
        "A decimal with multiple separators was accepted"
    );

    expect(
        tex::render_expression(M::negate(M::decimal("056.321"))) == "-056.321",
        "A negative decimal was not lowered losslessly"
    );
    expect(
        tex::render_expression(M::negate(M::add(M::id_a, M::id_b))) == R"(-\left(a + b\right))",
        "Negating a binary expression lost its grouping"
    );
    expect(
        tex::render_expression(M::add(M::id_a, M::negate(M::id_b))) == R"(a + \left(-b\right))",
        "A negative right-hand additive term became ambiguous"
    );
    expect(
        tex::render_expression(M::add(M::id_x, M::add(M::negate(M::id_a), M::id_b)))
            == R"(x + \left(-a + b\right))",
        "An additive subtree beginning with negation became ambiguous"
    );
    expect(
        tex::render_expression(M::negate(M::csv(M::id_a, M::id_b))) == R"(-\left(a, b\right))",
        "Negating a comma-separated expression lost its grouping"
    );
}

auto test_thesis_vocabulary() -> void
{
    using M = Math;
    namespace tex = dans::document::connectors::tex;

    expect(
        tex::render_expression(M::not_equal(M::id_a, M::id_b)) == R"(a \neq b)",
        "Not-equal lowering changed"
    );
    expect(
        tex::render_expression(M::less_equal(M::id_a, M::id_b)) == R"(a \leq b)",
        "Less-equal lowering changed"
    );
    expect(
        tex::render_expression(M::less_than(M::id_a, M::id_b)) == "a < b",
        "Less-than lowering changed"
    );
    expect(
        tex::render_expression(M::greater_than(M::id_a, M::id_b)) == "a > b",
        "Greater-than lowering changed"
    );
    expect(
        tex::render_expression(M::greater_equal(M::id_a, M::id_b)) == R"(a \geq b)",
        "Greater-equal lowering changed"
    );
    expect(
        tex::render_expression(M::approximately_equal(M::id_a, M::id_b)) == R"(a \approx b)",
        "Approximate-equality lowering changed"
    );
    expect(
        tex::render_expression(M::similar(M::id_a, M::id_b)) == R"(a \sim b)",
        "Similarity lowering changed"
    );
    expect(
        tex::render_expression(M::element_of(M::id_i, M::id_A)) == R"(i \in A)",
        "Set-membership lowering changed"
    );
    expect(
        tex::render_expression(M::right_arrow(M::id_a, M::id_b)) == R"(a \to b)",
        "Right-arrow lowering changed"
    );
    expect(
        tex::render_expression(M::maps_to(M::id_a, M::id_b)) == R"(a \mapsto b)",
        "Maps-to lowering changed"
    );
    expect(
        tex::render_expression(M::tensor_product(M::id_A, M::id_B)) == R"(A \otimes B)",
        "Tensor-product lowering changed"
    );
    expect(
        tex::render_expression(M::product(M::id_a, M::id_b)) == "a * b",
        "Asterisk-product lowering changed"
    );
    expect(
        tex::render_expression(M::center_dot(M::id_a, M::id_b)) == R"(a \cdot b)",
        "Centered-dot lowering changed"
    );
    expect(
        tex::render_expression(M::times(M::id_a, M::id_b)) == R"(a \times b)",
        "Times lowering changed"
    );
    expect(
        tex::render_expression(M::divide(M::id_a, M::id_b)) == "a / b", "Division lowering changed"
    );
    expect(
        tex::render_expression(
            M::sequence(
                M::id_partial,
                M::id_infinity,
                M::id_ellipsis,
                M::id_centered_ellipsis,
                M::id_dagger,
                M::id_transpose,
                M::id_script_ell
            )
        ) == R"({\partial}{\infty}{\dots}{\cdots}{\dagger}{\top}{\ell})",
        "Special-symbol lowering changed"
    );

    const auto relation =
        M::less_equal(M::add(M::id_a, M::id_b), M::tensor_product(M::id_A, M::id_B));
    expect(
        tex::render_expression(relation) == R"(a + b \leq A \otimes B)",
        "Mixed relation precedence changed"
    );

    const auto spectrum = M::element_of(
        M::named_operator("spectrum").argument(M::calligraphic("H")), M::blackboard("R")
    );
    expect(
        tex::render_expression(spectrum)
            == R"(\operatorname{spectrum}\!\left[\mathcal{H}\right] \in \mathbb{R})",
        "Named-operator or decorated-identifier lowering changed"
    );
    expect(
        tex::render_expression(M::function("f").argument(M::blackboard("C")))
            == R"(f\!\left(\mathbb{C}\right))",
        "Ordinary function application lowering changed"
    );
    expect(
        tex::render_expression(
            M::underbrace(M::center_dot(M::upright("cores"), M::id_2), M::text("FMA & SIMD"))
        ) == R"(\underbrace{\mathrm{cores} \cdot 2}_{\text{FMA \& SIMD}})",
        "Upright identifier, math text, or underbrace lowering changed"
    );
    expect(
        tex::render_expression(M::text(R"(\{}$&#%_~^)"))
            == R"(\text{\textbackslash{}\{\}\$\&\#\%\_\textasciitilde{}\textasciicircum{}})",
        "Math-text escaping changed"
    );
}

auto run_test() -> void
{
    test_model();
    test_latex();
    test_numeric_literals_and_negation();
    test_thesis_vocabulary();
}
}  // namespace

auto main() noexcept -> int
{
    try
    {
        run_test();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_math_structures_test failed: {}", error.what());
        }
        catch (...)
        {
            return 1;
        }
        return 1;
    }
    catch (...)
    {
        return 1;
    }
}
