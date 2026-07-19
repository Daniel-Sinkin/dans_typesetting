// Verify structured fractions, radicals, and scripts in the native math model.
#include "connectors/latex/math.hpp"
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

    expect(
        rendered.contains(R"(\frac{{x}_{i}}{\sqrt{y}})"),
        "A structured fraction or its nested square root was not lowered to LaTeX"
    );
    expect(
        rendered.contains(R"({\sqrt[3]{z}}^{2})"),
        "An indexed root or its superscript was not lowered to LaTeX"
    );
}

auto run_test() -> void
{
    test_model();
    test_latex();
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
