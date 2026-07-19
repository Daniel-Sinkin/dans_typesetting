// tests/native_markdown_test.cpp — exercise Markdown lowering, numbering, and failures.
#include "connectors/markdown/bibliography.hpp"
#include "connectors/markdown/code_listing.hpp"
#include "connectors/markdown/color_span.hpp"
#include "connectors/markdown/core_paragraph.hpp"
#include "connectors/markdown/document_shell.hpp"
#include "connectors/markdown/figure_pair.hpp"
#include "connectors/markdown/footnote.hpp"
#include "connectors/markdown/hyperlink.hpp"
#include "connectors/markdown/image.hpp"
#include "connectors/markdown/inline_code.hpp"
#include "connectors/markdown/item_list.hpp"
#include "connectors/markdown/math.hpp"
#include "connectors/markdown/reference.hpp"
#include "connectors/markdown/table.hpp"
#include "document.hpp"
#include "plugins/bibliography.hpp"
#include "plugins/code_listing.hpp"
#include "plugins/color_span.hpp"
#include "plugins/core_paragraph.hpp"
#include "plugins/document_shell.hpp"
#include "plugins/figure_pair.hpp"
#include "plugins/footnote.hpp"
#include "plugins/hyperlink.hpp"
#include "plugins/image.hpp"
#include "plugins/inline_code.hpp"
#include "plugins/item_list.hpp"
#include "plugins/math.hpp"
#include "plugins/reference.hpp"
#include "plugins/table.hpp"
#include "reference_id.hpp"
#include "writers/markdown_writer.hpp"

#include <exception>
#include <filesystem>
#include <memory>
#include <print>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

namespace
{
namespace markdown = dans::document::connectors::markdown;

auto expect_contains(
    const std::string_view rendered, const std::string_view expected, const std::string_view context
) -> void
{
    if (!rendered.contains(expected))
    {
        throw std::runtime_error{
            std::string{context} + ": expected Markdown to contain " + std::string{expected}
        };
    }
}

auto make_inline_renderer() -> std::shared_ptr<markdown::CoreParagraphInlineMarkdownRenderer>
{
    auto renderer = std::make_shared<markdown::CoreParagraphInlineMarkdownRenderer>();
    renderer->register_inline_adapter(std::make_unique<markdown::CoreTextMarkdownAdapter>());
    renderer->register_inline_adapter(std::make_unique<markdown::HyperlinkMarkdownAdapter>());
    renderer->register_inline_adapter(std::make_unique<markdown::InlineCodeMarkdownAdapter>());
    renderer->register_inline_adapter(std::make_unique<markdown::ColorSpanMarkdownAdapter>());
    renderer->register_inline_adapter(std::make_unique<markdown::FootnoteMarkdownAdapter>());
    renderer->register_inline_adapter(std::make_unique<markdown::CitationMarkdownAdapter>());
    renderer->register_inline_adapter(std::make_unique<markdown::InlineMathMarkdownAdapter>());
    renderer->register_inline_adapter(std::make_unique<markdown::InlineImageMarkdownAdapter>());
    renderer->register_inline_adapter(std::make_unique<markdown::ReferenceMarkdownAdapter>());
    return renderer;
}

auto make_writer(
    const std::shared_ptr<const markdown::CoreParagraphInlineMarkdownRenderer>& renderer
) -> dans::document::writers::MarkdownWriter
{
    dans::document::writers::MarkdownWriter writer{};
    writer.register_block_adapter(
        std::make_unique<markdown::CoreParagraphMarkdownAdapter>(renderer)
    );
    writer.register_block_adapter(std::make_unique<markdown::TitlePageMarkdownAdapter>());
    writer.register_block_adapter(std::make_unique<markdown::TableOfContentsMarkdownAdapter>());
    writer.register_block_adapter(std::make_unique<markdown::PageBreakMarkdownAdapter>());
    writer.register_block_adapter(std::make_unique<markdown::ItemListMarkdownAdapter>(renderer));
    writer.register_block_adapter(std::make_unique<markdown::CodeListingMarkdownAdapter>(renderer));
    writer.register_block_adapter(std::make_unique<markdown::FigureMarkdownAdapter>(renderer));
    writer.register_block_adapter(std::make_unique<markdown::FigurePairMarkdownAdapter>(renderer));
    writer.register_block_adapter(std::make_unique<markdown::TableMarkdownAdapter>(renderer));
    writer.register_block_adapter(std::make_unique<markdown::DisplayMathMarkdownAdapter>());
    writer.register_block_adapter(std::make_unique<markdown::BibliographyMarkdownAdapter>());
    return writer;
}

auto render_representative_document() -> std::string
{
    using namespace dans::document;
    using namespace dans::document::plugins;
    using M = Math;

    const ReferenceId section_id{"sec:overview"};
    const ReferenceId figure_id{"fig:plot"};
    const ReferenceId figure_pair_id{"fig:pair"};
    const ReferenceId figure_pair_left_id{"fig:pair:left"};
    const ReferenceId table_id{"tab:values"};
    const ReferenceId listing_id{"lst:kernel"};
    const ReferenceId equation_id{"eq:energy"};
    const ReferenceId second_equation_id{"eq:momentum"};

    Document document{Metadata{.major = 2, .minor = 1, .patch = 3}};
    document.blocks().add<TitlePage>("Markdown * Thesis", "Daniel", "19 July 2026");
    document.blocks().add<TableOfContents>();
    document.blocks().add<PageBreak>();
    auto& overview = document.blocks().add<Section>("Overview & goals", section_id);
    auto& prose = overview.blocks().add<CoreParagraph>();
    prose.append_text("A # literal, 1. not a list, $cash$, &copy;, and ~~plain~~; ");
    prose.append_text(" bold ", TextStyle::bold);
    prose.append_text(" link ");
    prose.inlines().add<Hyperlink>("https://example.com/a_(b)?x=1&y=2", "results");
    prose.append_text(" code ");
    prose.inlines().add<InlineCode>("value`with`ticks");
    prose.append_text(" math ");
    prose.inlines().add<Math::Inline>(M::fraction(M::id_1, M::id_2));
    prose.append_text(" emoji ");
    prose.inlines().add<InlineImage>(ImageSource{"assets/tiny icon.png"});
    prose.append_text(" color ");
    auto& colored = prose.inlines().add<ColorSpan>(RgbColor{.red = 12, .green = 160, .blue = 255});
    colored.inlines().add<CoreText>("blue & bold", TextStyle::bold);
    prose.append_text(" note");
    auto& footnote = prose.inlines().add<Footnote>();
    footnote.append_text("See ");
    footnote.inlines().add<Hyperlink>("https://example.com/note", "source");
    prose.append_text(" citing ");
    prose.inlines().add<Citation>(
        std::initializer_list<CitationKey>{CitationKey{"Smith2024"}, CitationKey{"Doe2025"}}
    );
    prose.append_text(".");

    auto& details = overview.blocks().add<Section>("Nested details");
    auto& list = details.blocks().add<ItemList>(ListPresentation::enumerated);
    list.add_item("First item");
    auto& second_item = list.add_item();
    second_item.append_text("Second with ");
    second_item.inlines().add<InlineCode>("x | y");

    details.blocks().add<Figure>(
        ImageSource{"figures/sample plot.png"},
        figure_id,
        "Runtime *plot*.",
        RelativeWidth::from_percent(70.0),
        PixelExtent{1280, 720}
    );
    auto left_panel =
        FigurePanel{ImageSource{"figures/left panel.png"}, "Left ", figure_pair_left_id};
    left_panel.caption().add<Math::Inline>(M::id_J.subscript(M::id_1));
    details.blocks().add<FigurePair>(
        std::move(left_panel),
        FigurePanel{ImageSource{"figures/right panel.png"}, "Right panel"},
        figure_pair_id,
        "Paired result."
    );

    auto& table = details.blocks().add<Table>(2, "Measured values.", table_id);
    table.set_column_alignment(1, TableColumnAlignment::right);
    auto& header = table.add_row();
    header.cell(0).append_text("Name");
    header.cell(1).append_text("Value");
    auto& row = table.add_row();
    row.cell(0).append_text("A | B");
    row.cell(1).inlines().add<Math::Inline>(M::id_2.superscript(M::id_3));
    table.set_header_rows(1);

    details.blocks().add<CodeListing>(
        CodeLanguage::cuda,
        "__global__ void f() {\n    // ``` remains source\n}\n",
        listing_id,
        "CUDA kernel."
    );
    details.blocks()
        .add<M::Display>(
            M::equal(M::id_E, M::sequence(M::id_m, M::id_c.superscript(M::id_2))), equation_id
        )
        .add_equation(M::equal(M::id_p, M::sequence(M::id_m, M::id_v)), second_equation_id);

    auto& references = details.blocks().add<CoreParagraph>("See ");
    references.inlines().add<Reference>(section_id);
    references.append_text(", ");
    references.inlines().add<Reference>(figure_id);
    references.append_text(", ");
    references.inlines().add<Reference>(figure_pair_id);
    references.append_text(", ");
    references.inlines().add<Reference>(figure_pair_left_id);
    references.append_text(", ");
    references.inlines().add<Reference>(table_id);
    references.append_text(", ");
    references.inlines().add<Reference>(listing_id);
    references.append_text(", and ");
    references.inlines().add<Reference>(equation_id);
    references.append_text(" and ");
    references.inlines().add<Reference>(second_equation_id);
    references.append_text(".");

    auto& bibliography = document.blocks().add<Bibliography>();
    bibliography
        .add_entry(
            CitationKey{"Smith2024"},
            BibliographyEntryKind::article,
            "Fast contractions",
            {"Ada Smith", "Kai Li"}
        )
        .set_year(2024)
        .set_venue("Journal of Tensor Methods")
        .set_doi("10.1000/tensor.2024");
    bibliography
        .add_entry(
            CitationKey{"Doe2025"},
            BibliographyEntryKind::web,
            "Reproducible GPU measurements",
            {"Jane Doe"}
        )
        .set_year(2025)
        .set_url("https://example.com/gpu-results");

    const auto renderer = make_inline_renderer();
    auto writer = make_writer(renderer);
    std::ostringstream output{};
    writer.serialize(document, output);
    writer.write_file(document, std::filesystem::path{DANS_TYPESETTING_MARKDOWN_TEST_OUTPUT});
    return output.str();
}

auto expect_strict_failures() -> void
{
    using namespace dans::document;
    using namespace dans::document::plugins;

    const auto renderer = make_inline_renderer();
    auto writer = make_writer(renderer);

    Document unresolved{};
    auto& unresolved_paragraph = unresolved.blocks().add<CoreParagraph>();
    unresolved_paragraph.inlines().add<Reference>(ReferenceId{"fig:missing"});
    auto rejected_unresolved = false;
    try
    {
        std::ostringstream output{};
        writer.serialize(unresolved, output);
    }
    catch (const std::invalid_argument&)
    {
        rejected_unresolved = true;
    }
    if (!rejected_unresolved)
    {
        throw std::runtime_error{"An unresolved Markdown reference was accepted"};
    }

    Document duplicate{};
    duplicate.blocks().add<Section>("Section", ReferenceId{"shared:id"});
    duplicate.blocks().add<Figure>(
        ImageSource{"figure.png"}, ReferenceId{"shared:id"}, "Duplicate target"
    );
    auto rejected_duplicate = false;
    try
    {
        std::ostringstream output{};
        writer.serialize(duplicate, output);
    }
    catch (const std::invalid_argument&)
    {
        rejected_duplicate = true;
    }
    if (!rejected_duplicate)
    {
        throw std::runtime_error{"Duplicate Markdown reference targets were accepted"};
    }

    Document unsupported{};
    unsupported.blocks().add<CoreParagraph>().inlines().add<InlineCode>("missing adapter");
    auto text_only_renderer = std::make_shared<markdown::CoreParagraphInlineMarkdownRenderer>();
    text_only_renderer->register_inline_adapter(
        std::make_unique<markdown::CoreTextMarkdownAdapter>()
    );
    dans::document::writers::MarkdownWriter incomplete_writer{};
    incomplete_writer.register_block_adapter(
        std::make_unique<markdown::CoreParagraphMarkdownAdapter>(text_only_renderer)
    );
    auto rejected_missing_adapter = false;
    try
    {
        std::ostringstream output{};
        incomplete_writer.serialize(unsupported, output);
    }
    catch (const std::runtime_error&)
    {
        rejected_missing_adapter = true;
    }
    if (!rejected_missing_adapter)
    {
        throw std::runtime_error{"Missing Markdown inline adapter did not fail explicitly"};
    }
}
}  // namespace

auto main() noexcept -> int
{
    try
    {
        const auto rendered = render_representative_document();
        expect_contains(rendered, "<!-- Document model version 2.1.3 -->", "metadata");
        expect_contains(rendered, "# Markdown \\* Thesis", "title escaping");
        expect_contains(rendered, "## Contents", "table of contents");
        expect_contains(rendered, "- [Overview \\& goals](#sec:overview)", "top-level ToC entry");
        expect_contains(rendered, "  - [Nested details](#dans-section-1)", "nested ToC entry");
        expect_contains(rendered, "<a id=\"sec:overview\"></a>\n# Overview \\& goals", "section");
        expect_contains(
            rendered,
            "A \\# literal, 1\\. not a list, \\$cash\\$, \\&copy;, and "
            "\\~\\~plain\\~\\~;  **bold**  link",
            "styled prose and literal Markdown punctuation"
        );
        expect_contains(
            rendered, "[results](<https://example.com/a_(b)?x=1&y=2>)", "hyperlink destination"
        );
        expect_contains(rendered, "``value`with`ticks``", "collision-free inline code");
        expect_contains(rendered, "$\\frac{1}{2}$", "inline structured math");
        expect_contains(rendered, "![](<assets/tiny icon.png>)", "inline image");
        expect_contains(
            rendered, "<span style=\"color: #0CA0FF\">**blue \\& bold**</span>", "colour span"
        );
        expect_contains(rendered, "note[^1]", "footnote reference");
        expect_contains(
            rendered, "[^1]: See [source](<https://example.com/note>)", "footnote definition"
        );
        expect_contains(
            rendered, "citing [[1](#dans-resource-1), [2](#dans-resource-2)]", "numeric citations"
        );
        expect_contains(rendered, "1. First item\n1. Second with `x | y`", "enumerated list");
        expect_contains(rendered, "![](<figures/sample plot.png>)", "figure image");
        expect_contains(rendered, "*Figure 1: Runtime \\*plot\\*\\.*", "figure caption");
        expect_contains(
            rendered,
            "| ![](<figures/left panel.png>) | ![](<figures/right panel.png>) |",
            "paired figure images"
        );
        expect_contains(rendered, "| *(a) Left ${J}_{1}$* | *(b) Right panel* |", "panel captions");
        expect_contains(rendered, "*Figure 2: Paired result\\.*", "paired figure caption");
        expect_contains(rendered, "| Name | Value |", "table header");
        expect_contains(rendered, "| A \\| B | ${2}^{3}$ |", "rich table row");
        expect_contains(rendered, "*Table 1: Measured values\\.*", "table caption");
        expect_contains(rendered, "````cuda\n", "collision-free listing fence");
        expect_contains(rendered, "**Listing 1:** CUDA kernel\\.", "listing caption");
        expect_contains(rendered, "<a id=\"eq:energy\"></a>\n$$", "equation anchor");
        expect_contains(rendered, "*Equation 1*", "equation number");
        expect_contains(rendered, "<a id=\"eq:momentum\"></a>\n$$", "second equation anchor");
        expect_contains(rendered, "*Equation 2*", "second equation number");
        expect_contains(
            rendered,
            "[Section 1](#sec:overview), [Figure 1](#fig:plot), "
            "[Figure 2](#fig:pair), [Figure 2a](#fig:pair:left), "
            "[Table 1](#tab:values), [Listing 1](#lst:kernel), and "
            "[Equation 1](#eq:energy) and [Equation 2](#eq:momentum)",
            "resolved semantic references"
        );
        expect_contains(rendered, "class=\"dans-page-break\"", "page-break intent");
        expect_contains(rendered, "## References", "references heading");
        expect_contains(
            rendered,
            "1. <a id=\"dans-resource-1\"></a>Ada Smith and Kai Li. "
            "*Fast contractions*. Journal of Tensor Methods. 2024. "
            "[doi:10\\.1000/tensor\\.2024](<https://doi.org/10.1000/tensor.2024>)",
            "first bibliography entry"
        );
        expect_contains(
            rendered,
            "2. <a id=\"dans-resource-2\"></a>Jane Doe. "
            "*Reproducible GPU measurements*. 2025. "
            "[https://example\\.com/gpu\\-results](<https://example.com/gpu-results>)",
            "second bibliography entry"
        );
        expect_strict_failures();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_markdown_test failed: {}", error.what());
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
