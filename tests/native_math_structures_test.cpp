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
    expect(cube_root.radical_degree()->integer_value() == 3, "An indexed root changed its degree");

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
}

auto run_test() -> void
{
    test_model();
    test_latex();
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
