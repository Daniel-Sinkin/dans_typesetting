// Verify Grid topology, boundary intent, nesting, and publication connectors.
#include "connectors/latex/grid.hpp"
#include "connectors/latex/paragraph.hpp"
#include "connectors/markdown/grid.hpp"
#include "connectors/markdown/paragraph.hpp"
#include "document.hpp"
#include "plugins/grid.hpp"
#include "plugins/paragraph.hpp"
#include "writers/latex_writer.hpp"
#include "writers/markdown_writer.hpp"

#include <exception>
#include <memory>
#include <print>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

namespace
{
namespace latex = dans::document::connectors::latex;
namespace markdown = dans::document::connectors::markdown;
using namespace dans::document;
using namespace dans::document::plugins;

auto expect(const bool condition, const std::string_view message) -> void
{
    if (!condition)
    {
        throw std::runtime_error{std::string{message}};
    }
}

template <typename Exception, typename Function>
auto expect_throws(Function&& function, const std::string_view message) -> void
{
    auto rejected = false;
    try
    {
        std::forward<Function>(function)();
    }
    catch (const Exception&)
    {
        rejected = true;
    }
    expect(rejected, message);
}

auto make_document() -> Document
{
    Document document{};
    auto& grid = document.blocks().add<Grid>(2, 2, GridGaps{.row_em = 1.0, .column_em = 2.0});
    grid.set_outer_edges(GridEdgeStyle::single);
    grid.set_horizontal_edge(1, GridEdgeStyle::double_line);
    grid.set_vertical_edge(1, GridEdgeStyle::single);
    grid.cell(0, 0).add<Paragraph>("Upper left");
    grid.cell(0, 1).add<Paragraph>("Upper right");
    grid.cell(1, 0).add<Paragraph>("Lower left");
    auto& nested = grid.cell(1, 1).add<Grid>(1, 1);
    nested.set_all_edges(GridEdgeStyle::double_line);
    nested.cell(0, 0).add<Paragraph>("Nested cell");
    return document;
}

auto render_latex(const Document& document) -> std::string
{
    auto inline_renderer = std::make_shared<latex::InlineLatexRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<latex::TextLatexAdapter>());
    writers::LatexWriter writer{};
    writer.register_block_adapter(std::make_unique<latex::GridLatexAdapter>());
    writer.register_block_adapter(std::make_unique<latex::ParagraphLatexAdapter>(inline_renderer));
    std::ostringstream output{};
    writer.serialize(document, output);
    return output.str();
}

auto render_markdown(const Document& document) -> std::string
{
    auto inline_renderer = std::make_shared<markdown::InlineMarkdownRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<markdown::TextMarkdownAdapter>());
    writers::MarkdownWriter writer{};
    writer.register_block_adapter(std::make_unique<markdown::GridMarkdownAdapter>());
    writer.register_block_adapter(
        std::make_unique<markdown::ParagraphMarkdownAdapter>(inline_renderer)
    );
    std::ostringstream output{};
    writer.serialize(document, output);
    return output.str();
}
}  // namespace

auto run_test() -> void
{
    const auto document = make_document();
    const auto* grid = dynamic_cast<const Grid*>(document.blocks().blocks().front().get());
    expect(grid != nullptr, "The sample document lost its Grid block");
    expect(grid->child_sequence_count() == dans::usize{4}, "Grid exposed the wrong cell count");
    expect(grid->cell_sequence_id(1, 0) == "cell:1:0", "Grid cell identity is not row-major");
    expect(
        grid->horizontal_edge(1) == GridEdgeStyle::double_line,
        "Grid lost its internal horizontal edge"
    );

    const auto latex_output = render_latex(document);
    expect(
        latex_output.contains(R"(p{\dimexpr(\linewidth-2em-3\arrayrulewidth)/2\relax})"),
        "LaTeX did not derive equal cell width from the column gap"
    );
    expect(latex_output.contains("\\hline\\hline"), "LaTeX lost double Grid edges");
    expect(latex_output.contains("Nested cell"), "LaTeX dropped recursively nested Grid content");

    const auto markdown_output = render_markdown(document);
    expect(
        markdown_output.contains("<!-- Grid layout flattened row-major: 2 x 2 -->"),
        "Markdown did not disclose its Grid flattening policy"
    );
    expect(
        markdown_output.contains("Upper left") && markdown_output.contains("Nested cell"),
        "Markdown dropped Grid cell content"
    );

    expect_throws<std::invalid_argument>(
        [] { static_cast<void>(Grid{0, 1}); }, "Grid accepted an empty dimension"
    );
    expect_throws<std::invalid_argument>(
        [] { static_cast<void>(Grid{9, 8}); }, "Grid accepted more than 64 cells"
    );
    expect_throws<std::invalid_argument>(
        [] { static_cast<void>(Grid{1, 1, GridGaps{.row_em = 17.0}}); },
        "Grid accepted an excessive gap"
    );
    expect_throws<std::out_of_range>(
        [&grid] { static_cast<void>(grid->cell(2, 0)); },
        "Grid accepted an out-of-range cell coordinate"
    );
}

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
            std::println("native_grid_test failed: {}", error.what());
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
