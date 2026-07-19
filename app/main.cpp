#include "connectors/latex/bibliography.hpp"
#include "connectors/latex/code_listing.hpp"
#include "connectors/latex/color_span.hpp"
#include "connectors/latex/document_shell.hpp"
#include "connectors/latex/excalidraw_drawing.hpp"
#include "connectors/latex/figure_pair.hpp"
#include "connectors/latex/footnote.hpp"
#include "connectors/latex/hyperlink.hpp"
#include "connectors/latex/image.hpp"
#include "connectors/latex/inline_code.hpp"
#include "connectors/latex/item_list.hpp"
#include "connectors/latex/latex_math.hpp"
#include "connectors/latex/latex_mixin.hpp"
#include "connectors/latex/math.hpp"
#include "connectors/latex/paragraph.hpp"
#include "connectors/latex/reference.hpp"
#include "connectors/latex/table.hpp"
#include "document.hpp"
#include "plugins/bibliography.hpp"
#include "plugins/code_listing.hpp"
#include "plugins/color_span.hpp"
#include "plugins/document_shell.hpp"
#include "plugins/excalidraw_drawing.hpp"
#include "plugins/figure_pair.hpp"
#include "plugins/footnote.hpp"
#include "plugins/hyperlink.hpp"
#include "plugins/image.hpp"
#include "plugins/inline_code.hpp"
#include "plugins/item_list.hpp"
#include "plugins/latex_math.hpp"
#include "plugins/latex_mixin.hpp"
#include "plugins/math.hpp"
#include "plugins/math_matvec.hpp"
#include "plugins/paragraph.hpp"
#include "plugins/reference.hpp"
#include "plugins/table.hpp"
#include "plugins/table_csv.hpp"
#include "reference_id.hpp"
#include "writers/latex_writer.hpp"

#include <cstdio>
#include <cstdlib>
#include <exception>
#include <filesystem>
#include <memory>
#include <print>
#include <string_view>
#include <utility>

namespace
{
auto make_energy_equation()
{
    using M = dans::document::plugins::Math;

    return M::equal(
        M::function("E").argument(M::id_theta),
        M::summation().lower(M::id_i).body(
            M::inner_product()
                .term(M::id_psi.subscript(M::id_theta))
                .term(M::id_H.subscript(M::id_i))
                .term(M::id_psi.subscript(M::id_theta))
        )
    );
}

auto make_gradient_equation()
{
    using M = dans::document::plugins::Math;
    using D = M::Delimiter;
    using S = M::Symbol;

    const auto local_energy = [] { return M::id_E.subscript(M::ident("loc")); };
    const auto conjugate_log_derivative = []
    { return M::id_O.subscript(M::id_theta).superscript(M::symbol(S::asterisk)); };
    const auto expectation = [](M expression)
    { return M::delimited(D::angle).body(std::move(expression)); };

    auto covariance = M::subtract(
        expectation(M::sequence(local_energy(), conjugate_log_derivative())),
        M::sequence(expectation(local_energy()), expectation(conjugate_log_derivative()))
    );

    return M::equal(
        M::sequence(M::id_nabla.subscript(M::id_theta), M::id_E),
        M::sequence(M::id_2, M::named_operator("Re").argument(std::move(covariance)))
    );
}

auto make_matrix_vector_equation()
{
    using M = dans::document::plugins::Math;
    using MV = M::MatVec;

    return M::equal(
        M::sequence(
            MV::matrix(MV::row(M::id_a, M::id_b), MV::row(M::id_c, M::id_d)),
            MV::column_vector(M::id_x, M::id_y)
        ),
        MV::column_vector(M::id_r, M::id_s)
    );
}

auto make_fraction_radical_equation()
{
    using M = dans::document::plugins::Math;

    return M::equal(
        M::fraction(
            M::id_x.subscript(M::id_i).superscript(M::id_2),
            M::square_root(M::add(M::id_1, M::id_y))
        ),
        M::nth_root(M::id_3, M::id_z)
    );
}

auto make_relation_vocabulary_equation()
{
    using M = dans::document::plugins::Math;

    return M::approximately_equal(
        M::divide(
            M::sequence(M::id_partial, M::id_E),
            M::sequence(M::id_partial, M::id_theta.subscript(M::id_i))
        ),
        M::tensor_product(M::id_A, M::id_B)
    );
}

auto make_operator_vocabulary_equation()
{
    using M = dans::document::plugins::Math;

    return M::element_of(
        M::named_operator("spectrum").argument(M::calligraphic("H")), M::blackboard("R")
    );
}

auto make_annotation_equation()
{
    using M = dans::document::plugins::Math;

    return M::equal(
        M::id_F.subscript(M::text("peak")),
        M::underbrace(M::center_dot(M::upright("cores"), M::id_2), M::text("FMA"))
    );
}

auto make_numeric_literal_equation()
{
    using M = dans::document::plugins::Math;

    return M::equal(M::id_epsilon, M::negate(M::decimal("0.125")));
}

auto make_sample_document()
{
    using namespace dans::document;
    using namespace dans::document::plugins;

    using M = dans::document::plugins::Math;
    Document document{Metadata{.major = 0, .minor = 1, .patch = 0}};

    document.blocks().add<TitlePage>(
        "Dan's Typesetting Experiment", "Daniel Sinkin", "19 July 2026"
    );
    document.blocks().add<TableOfContents>();
    document.blocks().add<PageBreak>();

    const auto par_writer = [&](BlockSequence& blocks, std::string_view text)
    { blocks.add<Paragraph>(text); };

    auto& introduction =
        document.blocks().add<Section>("Introduction", ReferenceId{"sec:introduction"});
    auto& introduction_text = introduction.blocks().add<Paragraph>();
    introduction_text.append_text(
        "This document is represented as an owning C++ object model and exported through a "
        "separate LaTeX writer. Tensor-network background is summarized in "
    );
    introduction_text.inlines().add<Citation>(
        std::initializer_list<CitationKey>{CitationKey{"Verstraete2008"}, CitationKey{"Orus2014"}}
    );
    introduction_text.append_text(".");

    auto& architecture = document.blocks().add<Section>("Document architecture");
    par_writer(
        architecture.blocks(),
        "A document is an ordered sequence of semantic blocks. Sections are structural blocks "
        "that contain another ordered block sequence."
    );

    auto& content_plugins = architecture.blocks().add<Section>("Content plugins");
    par_writer(
        content_plugins.blocks(),
        "Paragraph nodes are supplied by a plugin module. The LaTeX exporter only accepts them "
        "after a matching connector has been registered."
    );

    auto& inline_extensions = architecture.blocks().add<Section>("Inline composition");
    auto& inline_paragraph = inline_extensions.blocks().add<Paragraph>();
    inline_paragraph.append_text("A paragraph can combine ordinary text, inline math such as ");
    inline_paragraph.inlines().add<Math::Inline>(M::id_x.subscript(M::id_i).superscript(M::id_2));
    inline_paragraph.append_text(", directly authored LaTeX math such as ");
    inline_paragraph.inlines().add<LatexMathInline>(R"(\rho_\beta \approx e^{-\beta H})");
    inline_paragraph.append_text(", and ");
    inline_paragraph.inlines().add<InlineCode>("cudaDeviceSynchronize()");
    inline_paragraph.append_text(" as semantic inline code, plus ");
    auto& color_span =
        inline_paragraph.inlines().add<ColorSpan>(RgbColor{.red = 38, .green = 96, .blue = 168});
    color_span.inlines().add<Text>("a coloured span containing both text and ");
    color_span.inlines().add<Math::Inline>(M::add(M::id_alpha, M::id_beta));
    inline_paragraph.append_text(", a tiny inline image ");
    inline_paragraph.inlines().add<InlineImage>(
        ImageSource{"sample-image.pdf"}, InlineImageHeight{1.1}
    );
    inline_paragraph.append_text(", and even a deliberate raw LaTeX escape hatch such as ");
    inline_paragraph.inlines().add<InlineLatex>(R"(\LaTeX{})");
    inline_paragraph.append_text(" in one ordered inline sequence.");

    auto& styled_paragraph = inline_extensions.blocks().add<Paragraph>();
    styled_paragraph.append_text("Text leaves can be ");
    styled_paragraph.append_text("bold", TextStyle::bold);
    styled_paragraph.append_text(", ");
    styled_paragraph.append_text("italic", TextStyle::italic);
    styled_paragraph.append_text(", or ");
    styled_paragraph.append_text("both", TextStyle::bold_italic);
    styled_paragraph.append_text(". Links can show their target as ");
    styled_paragraph.inlines().add<Hyperlink>("https://example.com/typesetting");
    styled_paragraph.append_text(" or use a nested label such as ");
    auto& labelled_link =
        styled_paragraph.inlines().add<Hyperlink>("https://example.com/thesis?part=1#results");
    labelled_link.label().add<Text>("the results", TextStyle::bold);
    styled_paragraph.append_text(". Footnotes share that same content contract");
    auto& footnote = styled_paragraph.inlines().add<Footnote>();
    footnote.append_text("A note can contain ");
    auto& footnote_link = footnote.inlines().add<Hyperlink>("https://example.com/source");
    footnote_link.label().add<Text>("a styled source", TextStyle::italic);
    footnote.append_text(" without storing its visible number.");
    styled_paragraph.append_text(".");

    auto& escaping = architecture.blocks().add<Section>("Backend-owned escaping");
    escaping.blocks().add<Paragraph>(
        "The paragraph model stores ordinary text such as CUDA & C++, block_size, and 50% "
        "without containing LaTeX escape sequences."
    );
    par_writer(
        architecture.blocks(),
        "Because sections share the same ordered block sequence as ordinary content, this "
        "paragraph can appear after the preceding subsections."
    );

    auto& lists = document.blocks().add<Section>("Semantic lists");
    par_writer(
        lists.blocks(),
        "List items consume the same extensible inline contract as paragraphs and captions."
    );
    auto& implementation_steps = lists.blocks().add<ItemList>(ListPresentation::enumerated);
    implementation_steps.add_item("Define one small semantic contract.", TextStyle::bold);
    auto& second_step = implementation_steps.add_item();
    second_step.append_text("Reuse structured inline mathematics such as ");
    second_step.inlines().add<Math::Inline>(M::equal(M::id_E, M::sequence(M::id_m, M::id_c)));
    second_step.append_text(" without adding list-specific math knowledge.");
    implementation_steps.add_item("Let each writer choose its own presentation.");

    auto& tables = document.blocks().add<Section>("Rich tables");
    par_writer(
        tables.blocks(),
        "The table plugin owns a rectangular grid of inline sequences. CSV is an optional "
        "plain-text adapter rather than the semantic model."
    );
    const ReferenceId benchmark_table_id{"tab:kernel-measurements"};
    auto& benchmark_table =
        tables.blocks().add<Table>(3, "Representative kernel measurements.", benchmark_table_id);
    import_table_csv(
        benchmark_table,
        "Kernel,Lattice,Runtime (ms)\ncontract,16 x 16,1.25\nsvd,32 x 32,8.50\n",
        TableCsvImportOptions{.first_row_is_header = true, .maximum_rows = 30}
    );
    benchmark_table.set_column_alignment(1, TableColumnAlignment::center);
    benchmark_table.set_column_alignment(2, TableColumnAlignment::right);
    auto& table_reference = tables.blocks().add<Paragraph>("The values summarized in ");
    table_reference.inlines().add<Reference>(benchmark_table_id);
    table_reference.append_text(
        " retain a stable target while their visible number is writer-owned."
    );

    auto& media = document.blocks().add<Section>("Figures and references");
    const ReferenceId sample_figure_id{"fig:sample-image"};
    auto& figure = media.blocks().add<Figure>(
        ImageSource{"sample-image.pdf"},
        sample_figure_id,
        "A block image sized relative to the available line width.",
        RelativeWidth::from_percent(52.0),
        PixelExtent{1280, 720}
    );
    figure.caption().add<Text>(" Captions share the inline contract, including ");
    figure.caption().add<Math::Inline>(M::id_A.subscript(M::csv(M::id_4, M::id_3)));
    figure.caption().add<Text>(".");

    auto first_panel = FigurePanel{
        ImageSource{"sample-image.pdf"},
        "Single-coupling model ",
        ReferenceId{"fig:model-comparison:left"},
        PixelExtent{1280, 720}
    };
    first_panel.caption().add<Math::Inline>(M::id_J.subscript(M::id_1));
    auto second_panel = FigurePanel{
        ImageSource{"sample-image.pdf"},
        "Frustrated model ",
        ReferenceId{"fig:model-comparison:right"},
        PixelExtent{1280, 720}
    };
    second_panel.caption().add<Math::Inline>(
        M::subtract(M::id_J.subscript(M::id_1), M::id_J.subscript(M::id_2))
    );
    media.blocks().add<FigurePair>(
        std::move(first_panel),
        std::move(second_panel),
        ReferenceId{"fig:model-comparison"},
        "A side-by-side comparison with independently referenceable panels."
    );

    media.blocks().add<ExcalidrawDrawing>(
        R"({"type":"excalidraw","version":2,"source":"dans.typesetting","elements":[],"appState":{"viewBackgroundColor":"#ffffff"},"files":{}})",
        ReferenceId{"fig:embedded-drawing"},
        "An embedded Excalidraw scene resolved to a writer-owned vector asset.",
        DrawingWidth::from_percent(72.0)
    );

    auto& figure_reference = media.blocks().add<Paragraph>();
    figure_reference.append_text("The visible number in ");
    figure_reference.inlines().add<Reference>(sample_figure_id);
    figure_reference.append_text(
        " belongs to the exporter, while the document model retains only its stable ID."
    );
    auto& panel_reference = media.blocks().add<Paragraph>("Composite targets resolve as ");
    panel_reference.inlines().add<Reference>(ReferenceId{"fig:model-comparison"});
    panel_reference.append_text(", ");
    panel_reference.inlines().add<Reference>(ReferenceId{"fig:model-comparison:left"});
    panel_reference.append_text(", and ");
    panel_reference.inlines().add<Reference>(ReferenceId{"fig:model-comparison:right"});
    panel_reference.append_text(".");

    auto& mathematics = document.blocks().add<Section>("Display mathematics");
    par_writer(
        mathematics.blocks(),
        "This aligned display group contains targeted equations, a targetless numbered equation, "
        "and an explicitly unnumbered note. Every line remains structured math rather than stored "
        "LaTeX source."
    );
    const ReferenceId energy_equation_id{"eq:energy"};
    const ReferenceId gradient_equation_id{"eq:gradient"};
    const ReferenceId matrix_equation_id{"eq:matrix-vector"};
    const ReferenceId fraction_radical_equation_id{"eq:fraction-radical"};
    const ReferenceId relation_vocabulary_equation_id{"eq:relation-vocabulary"};
    const ReferenceId operator_vocabulary_equation_id{"eq:operator-vocabulary"};
    const ReferenceId annotation_equation_id{"eq:math-annotation"};
    const ReferenceId numeric_literal_equation_id{"eq:numeric-literal"};
    mathematics.blocks()
        .add<M::Display>(make_energy_equation(), energy_equation_id)
        .add_equation(make_gradient_equation(), gradient_equation_id)
        .add_equation(M::equal(M::id_E, M::add(M::id_T, M::id_V)))
        .add_unnumbered(M::text("targetless explanatory line"));
    mathematics.blocks().add<M::Display>(make_matrix_vector_equation(), matrix_equation_id);
    mathematics.blocks().add<M::Display>(
        make_fraction_radical_equation(), fraction_radical_equation_id
    );
    mathematics.blocks().add<M::Display>(
        make_relation_vocabulary_equation(), relation_vocabulary_equation_id
    );
    mathematics.blocks().add<M::Display>(
        make_operator_vocabulary_equation(), operator_vocabulary_equation_id
    );
    mathematics.blocks().add<M::Display>(make_annotation_equation(), annotation_equation_id);
    mathematics.blocks().add<M::Display>(
        make_numeric_literal_equation(), numeric_literal_equation_id
    );
    mathematics.blocks().add<LatexMathDisplay>(
        R"(\mathcal{Z}(\beta) = \operatorname{Tr}\!\left(e^{-\beta H}\right))",
        LatexMathNumbering::numbered,
        ReferenceId{"eq:latex-authored"}
    );

    auto& equation_references = mathematics.blocks().add<Paragraph>();
    equation_references.append_text("The aligned group retains distinct targets: ");
    equation_references.inlines().add<Reference>(energy_equation_id);
    equation_references.append_text(" and ");
    equation_references.inlines().add<Reference>(gradient_equation_id);
    equation_references.append_text(", while rectangular matrix/vector composition appears in ");
    equation_references.inlines().add<Reference>(matrix_equation_id);
    equation_references.append_text(" and structured fractions and roots appear in ");
    equation_references.inlines().add<Reference>(fraction_radical_equation_id);
    equation_references.append_text(", and relation/product vocabulary appears in ");
    equation_references.inlines().add<Reference>(relation_vocabulary_equation_id);
    equation_references.append_text(", while named operators and decorated identifiers appear in ");
    equation_references.inlines().add<Reference>(operator_vocabulary_equation_id);
    equation_references.append_text(", and semantic math annotations appear in ");
    equation_references.inlines().add<Reference>(annotation_equation_id);
    equation_references.append_text(", and exact decimal spelling with structural negation in ");
    equation_references.inlines().add<Reference>(numeric_literal_equation_id);
    equation_references.append_text(".");

    auto& listings = document.blocks().add<Section>("Source-code listings");
    listings.blocks().add<CodeListing>(
        CodeLanguage::cpp,
        "#include <print>\n\nint main()\n{\n    std::println(\"Hello Typesetter!\");\n}\n",
        ReferenceId{"lst:hello-typesetter"},
        "A selectable and referenceable C++ source-code listing."
    );
    listings.blocks().add<CodeListing>(
        CodeLanguage::julia,
        "function energy(x)\n    return sum(abs2, x)\nend\n",
        ReferenceId{"lst:julia-energy"},
        "The same semantic listing block configured for Julia."
    );
    listings.blocks().add<CodeListing>(
        CodeLanguage::cuda,
        "__global__ void scale(float* values)\n"
        "{\n"
        "    values[threadIdx.x] *= 2.0F;\n"
        "}\n",
        ReferenceId{"lst:cuda-scale"}
    );
    listings.blocks().add<CodeListing>(
        CodeLanguage::raw,
        "Raw, byte-preserving source text can omit both caption and reference metadata.\n"
    );
    auto& listing_reference = listings.blocks().add<Paragraph>();
    listing_reference.append_text("The captionless CUDA kernel remains referenceable as ");
    listing_reference.inlines().add<Reference>(ReferenceId{"lst:cuda-scale"});
    listing_reference.append_text(".");

    auto& latex_escape = document.blocks().add<Section>("LaTeX escape hatch");
    par_writer(
        latex_escape.blocks(),
        "Raw LaTeX remains available as an explicitly backend-specific mixin, not as mathematics."
    );
    latex_escape.blocks().add<LatexBlock>(
        R"(\begin{center}\textit{This block bypasses the semantic model.}\end{center})"
    );

    auto& bibliography = document.blocks().add<Bibliography>();
    bibliography
        .add_entry(
            CitationKey{"Verstraete2008"},
            BibliographyEntryKind::article,
            "Matrix product states, projected entangled pair states, and variational "
            "renormalization group methods for quantum spin systems",
            {"Frank Verstraete", "J. Ignacio Cirac", "Valentin Murg"}
        )
        .set_year(2008)
        .set_venue("Advances in Physics")
        .set_doi("10.1080/14789940801912366");
    bibliography
        .add_entry(
            CitationKey{"Orus2014"},
            BibliographyEntryKind::article,
            "A practical introduction to tensor networks: Matrix product states and projected "
            "entangled pair states",
            {"Roman Orus"}
        )
        .set_year(2014)
        .set_venue("Annals of Physics")
        .set_doi("10.1016/j.aop.2014.06.013");

    return document;
}
}  // namespace

namespace
{
auto run(const int argc, char** argv) -> int
{
    if (argc > 2)
    {
        std::println(stderr, "Usage: document_example [output.tex]");
        return EXIT_FAILURE;
    }

    const auto output_path =
        argc == 2 ? std::filesystem::path{argv[1]} : std::filesystem::path{"sample-document.tex"};

    try
    {
        std::println("Hello Typesetter!");
        const auto document = make_sample_document();
        dans::document::writers::LatexWriter writer;
        auto inline_renderer =
            std::make_shared<dans::document::connectors::latex::InlineLatexRenderer>();
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::TextLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::InlineMathLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::LatexMathInlineAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::RawInlineLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::ColorSpanLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::InlineImageLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::ReferenceLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::HyperlinkLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::FootnoteLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::InlineCodeLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::CitationLatexAdapter>()
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::ParagraphLatexAdapter>(
                inline_renderer
            )
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::TitlePageLatexAdapter>()
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::TableOfContentsLatexAdapter>()
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::PageBreakLatexAdapter>()
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::DisplayMathLatexAdapter>()
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::LatexMathDisplayAdapter>()
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::FigureLatexAdapter>(inline_renderer)
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::FigurePairLatexAdapter>(
                inline_renderer
            )
        );
        const auto drawing_asset_path = output_path.parent_path() / "sample-excalidraw.pdf";
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::ExcalidrawDrawingLatexAdapter>(
                [drawing_asset_path](const dans::document::plugins::ExcalidrawDrawing&)
                { return std::filesystem::path{drawing_asset_path}; }
            )
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::CodeListingLatexAdapter>(
                inline_renderer
            )
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::ItemListLatexAdapter>(
                inline_renderer
            )
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::TableLatexAdapter>(inline_renderer)
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::LatexBlockAdapter>()
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::BibliographyLatexAdapter>()
        );
        writer.write_file(document, output_path);
        std::println("Wrote LaTeX document: {}", output_path.string());
    }
    catch (const std::exception& error)
    {
        std::println(stderr, "Failed to serialize document: {}", error.what());
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}
}  // namespace

auto main(const int argc, char* argv[]) noexcept -> int
{
    try
    {
        return run(argc, argv);
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println(stderr, "Fatal document-example error: {}", error.what());
        }
        catch (...)
        {
            return EXIT_FAILURE;
        }
        return EXIT_FAILURE;
    }
    catch (...)
    {
        return EXIT_FAILURE;
    }
}
