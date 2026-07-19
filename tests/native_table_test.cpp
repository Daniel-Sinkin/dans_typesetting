// Verify rich semantic tables plus the independent plain-text CSV adapter.
#include "connectors/latex/footnote.hpp"
#include "connectors/latex/math.hpp"
#include "connectors/latex/paragraph.hpp"
#include "connectors/latex/table.hpp"
#include "document.hpp"
#include "plugins/footnote.hpp"
#include "plugins/math.hpp"
#include "plugins/paragraph.hpp"
#include "plugins/table.hpp"
#include "plugins/table_csv.hpp"
#include "reference_id.hpp"
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
using dans::document::ReferenceId;
using dans::document::connectors::latex::FootnoteLatexAdapter;
using dans::document::connectors::latex::InlineLatexRenderer;
using dans::document::connectors::latex::InlineMathLatexAdapter;
using dans::document::connectors::latex::TableLatexAdapter;
using dans::document::connectors::latex::TextLatexAdapter;
using dans::document::plugins::Footnote;
using dans::document::plugins::Math;
using dans::document::plugins::Table;
using dans::document::plugins::TableColumnAlignment;
using dans::document::plugins::TableCsvImportOptions;
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

auto make_inline_renderer() -> std::shared_ptr<InlineLatexRenderer>
{
    auto renderer = std::make_shared<InlineLatexRenderer>();
    renderer->register_inline_adapter(std::make_unique<TextLatexAdapter>());
    renderer->register_inline_adapter(std::make_unique<InlineMathLatexAdapter>());
    renderer->register_inline_adapter(std::make_unique<FootnoteLatexAdapter>());
    return renderer;
}

auto test_csv() -> void
{
    constexpr auto source =
        "name,value\r\n\"CUDA, C++\",\"a \"\"quote\"\"\"\r\nline,\"embedded\nnewline\"\r\n";
    const auto parsed = dans::document::plugins::parse_table_csv(source);
    expect(parsed.rows.size() == 3, "CSV parser lost rows");
    expect(parsed.rows[1][0] == "CUDA, C++", "CSV parser lost a quoted comma");
    expect(parsed.rows[1][1] == "a \"quote\"", "CSV parser lost an escaped quote");
    expect(parsed.rows[2][1] == "embedded\nnewline", "CSV parser lost a quoted newline");

    const auto normalized = dans::document::plugins::serialize_table_csv(parsed);
    const auto reparsed = dans::document::plugins::parse_table_csv(normalized);
    expect(reparsed.rows == parsed.rows, "parse(serialize(parse(csv))) changed CSV data");

    Table imported{2, "Imported measurements", ReferenceId{"tab:imported"}};
    dans::document::plugins::import_table_csv(
        imported,
        "name,value\nalpha,1.25\nbeta,2.5\n",
        TableCsvImportOptions{.first_row_is_header = true, .maximum_rows = 30}
    );
    expect(imported.header_rows() == 1, "CSV header role was not imported");
    expect(imported.rows().size() == 3, "CSV rows were not imported");
    expect(
        dans::document::plugins::table_to_csv(imported) == "name,value\nalpha,1.25\nbeta,2.5\n",
        "Plain-text table CSV round trip changed data"
    );

    expect_rejected(
        [] { static_cast<void>(dans::document::plugins::parse_table_csv("a,b\n1\n")); },
        "A ragged CSV document was accepted"
    );
    expect_rejected(
        [] { static_cast<void>(dans::document::plugins::parse_table_csv("\"unfinished")); },
        "An unterminated CSV quote was accepted"
    );
    expect_rejected(
        []
        { static_cast<void>(dans::document::plugins::parse_table_csv("a\nb\n", dans::usize{1})); },
        "The CSV maximum-row bound was ignored"
    );
}

auto test_latex() -> void
{
    Document document;
    auto& table = document.blocks().add<Table>(
        2, "Runtime comparison", ReferenceId{"tab:runtime-comparison"}
    );
    table.set_column_alignment(0, TableColumnAlignment::left);
    table.set_column_alignment(1, TableColumnAlignment::right);
    auto& header = table.add_row();
    header.cell(0).append_text("Method");
    header.cell(1).append_text("Cost");
    auto& data = table.add_row();
    data.cell(0).append_text("Tensor & CUDA");
    data.cell(1).inlines().add<Math::Inline>(Math::equal(Math::id_N, Math::id_4));
    auto& note = data.cell(0).inlines().add<Footnote>();
    note.append_text("Measured on one GPU.");
    table.set_header_rows(1);
    table.caption().add<Math::Inline>(Math::id_N.subscript(Math::id_4));

    auto renderer = make_inline_renderer();
    LatexWriter writer;
    writer.register_block_adapter(std::make_unique<TableLatexAdapter>(renderer));
    std::ostringstream output;
    writer.serialize(document, output);
    const auto rendered = output.str();

    expect(rendered.contains("\\usepackage{booktabs}"), "Table support omitted booktabs");
    expect(rendered.contains("\\begin{tabular}{lr}"), "Column alignment was not lowered");
    expect(rendered.contains("\\toprule"), "Top table rule was not emitted");
    expect(rendered.contains("\\bfseries Method & \\bfseries Cost"), "Header role was lost");
    expect(rendered.contains("\\midrule"), "Header separator was not emitted");
    expect(
        rendered.contains(R"(Tensor \& CUDA\footnote{Measured on one GPU.} & \(N = 4\))"),
        "Rich table cells did not use the shared inline renderer"
    );
    expect(rendered.contains("\\caption{Runtime comparison"), "Table caption was not emitted");
    expect(
        rendered.contains("\\label{tab:runtime-comparison}"),
        "Table reference target was not emitted"
    );

    expect_rejected(
        [&renderer]
        {
            Document empty;
            empty.blocks().add<Table>(1, "Empty");
            LatexWriter empty_writer;
            empty_writer.register_block_adapter(std::make_unique<TableLatexAdapter>(renderer));
            std::ostringstream sink;
            empty_writer.serialize(empty, sink);
        },
        "An empty semantic table was rendered"
    );

    expect_rejected(
        [&table] { static_cast<void>(dans::document::plugins::table_to_csv(table)); },
        "CSV export silently flattened a structured table cell"
    );
}

auto run_test() -> void
{
    test_csv();
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
            std::println("native_table_test failed: {}", error.what());
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
