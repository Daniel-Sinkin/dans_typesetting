// Verify the rectangular math-grid primitive and optional MatVec authoring extension.
#include "connectors/latex/math.hpp"
#include "document.hpp"
#include "plugins/math.hpp"
#include "plugins/math_matvec.hpp"
#include "reference_id.hpp"
#include "writers/latex_writer.hpp"

#include <exception>
#include <memory>
#include <print>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace
{
using dans::document::Document;
using dans::document::ReferenceId;
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
auto expect_rejected(Operation&& operation, const std::string_view message) -> void
{
    auto rejected = false;
    try
    {
        operation();
    }
    catch (const std::exception&)
    {
        rejected = true;
    }
    expect(rejected, message);
}

auto make_matrix_vector_expression() -> Math
{
    using MV = Math::MatVec;
    return Math::equal(
        Math::sequence(
            MV::matrix(MV::row(Math::id_a, Math::id_b), MV::row(Math::id_c, Math::id_d)),
            MV::column_vector(Math::id_x, Math::id_y)
        ),
        MV::column_vector(Math::id_r, Math::id_s)
    );
}

auto test_model() -> void
{
    using MV = Math::MatVec;
    auto matrix = MV::matrix(
        MV::row(Math::id_1, Math::id_2, Math::id_3), MV::row(Math::id_4, Math::id_5, Math::id_6)
    );
    expect(matrix.kind() == Math::Kind::delimited, "A matrix did not lower to a delimiter");
    expect(matrix.delimited_style() == Math::Delimiter::square, "A matrix lost its brackets");
    const auto* grid = matrix.delimited_body();
    expect(grid != nullptr && grid->kind() == Math::Kind::grid, "A matrix did not contain a grid");
    expect(grid->grid_rows() == 2, "A rectangular matrix lost its row count");
    expect(grid->grid_columns() == 3, "A rectangular matrix lost its column count");
    expect(grid->grid_cells().size() == 6, "A rectangular matrix lost cells");

    auto row_vector = MV::row_vector(Math::id_a, Math::id_b, Math::id_c);
    expect(row_vector.delimited_body()->grid_rows() == 1, "A row vector gained rows");
    expect(row_vector.delimited_body()->grid_columns() == 3, "A row vector lost columns");

    auto column_vector = MV::column_vector(Math::id_a, Math::id_b, Math::id_c);
    expect(column_vector.delimited_body()->grid_rows() == 3, "A column vector lost rows");
    expect(column_vector.delimited_body()->grid_columns() == 1, "A column vector gained columns");

    expect_rejected(
        []
        {
            static_cast<void>(MV::matrix(
                MV::row(Math::id_1, Math::id_2), MV::row(Math::id_3, Math::id_4, Math::id_5)
            ));
        },
        "A ragged matrix was accepted"
    );
    expect_rejected(
        [] { static_cast<void>(Math::grid(0, 1, {})); }, "A zero-row core grid was accepted"
    );
    expect_rejected(
        []
        {
            std::vector<Math> cells{};
            cells.push_back(Math::id_1);
            static_cast<void>(Math::grid(2, 2, std::move(cells)));
        },
        "A core grid with the wrong cell count was accepted"
    );
    expect_rejected(
        []
        {
            std::vector<Math> cells{};
            cells.push_back(Math::equal(Math::id_a, Math::id_b).align_at_operator());
            Math::Inline inline_math{Math::grid(1, 1, std::move(cells))};
            static_cast<void>(inline_math);
        },
        "A display alignment point inside a grid cell was accepted"
    );
}

auto test_latex() -> void
{
    Document document;
    document.blocks().add<Math::Display>(
        make_matrix_vector_expression(), ReferenceId{"eq:matrix-vector"}
    );

    LatexWriter writer;
    writer.register_block_adapter(std::make_unique<DisplayMathLatexAdapter>());
    std::ostringstream output;
    writer.serialize(document, output);
    const auto rendered = output.str();

    expect(
        rendered.contains(R"(\left[\begin{matrix}a & b \\ c & d\end{matrix}\right])"),
        "A square matrix was not lowered to a LaTeX matrix"
    );
    expect(
        rendered.contains(R"(\left[\begin{matrix}x \\ y\end{matrix}\right])"),
        "A column vector was not lowered to a LaTeX matrix"
    );
    expect(rendered.contains("\\label{eq:matrix-vector}"), "The matrix equation lost its target");
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
            std::println("native_math_matvec_test failed: {}", error.what());
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
