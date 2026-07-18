#include "connectors/latex/color_span.hpp"
#include "connectors/latex/core_paragraph.hpp"
#include "connectors/latex/image.hpp"
#include "connectors/latex/latex_mixin.hpp"
#include "connectors/latex/math.hpp"
#include "connectors/latex/reference.hpp"
#include "document.hpp"
#include "plugins/color_span.hpp"
#include "plugins/core_paragraph.hpp"
#include "plugins/image.hpp"
#include "plugins/latex_mixin.hpp"
#include "plugins/math.hpp"
#include "plugins/reference.hpp"
#include "reference_id.hpp"
#include "writers/latex_writer.hpp"

#include <cstdlib>
#include <exception>
#include <filesystem>
#include <iostream>
#include <memory>
#include <string_view>
#include <utility>

namespace
{
auto make_energy_equation()
{
    using M = dans::document::plugins::Math;
    using S = M::Symbol;

    return M::equal(
        M::function("E").argument(M::symbol(S::theta)),
        M::summation()
            .lower(M::identifier("i"))
            .body(
                M::inner_product()
                    .term(M::symbol(S::psi).subscript(M::symbol(S::theta)))
                    .term(M::identifier("H").subscript(M::identifier("i")))
                    .term(M::symbol(S::psi).subscript(M::symbol(S::theta)))
            )
    );
}

auto make_gradient_equation()
{
    using M = dans::document::plugins::Math;
    using D = M::Delimiter;
    using S = M::Symbol;

    const auto local_energy = [] { return M::identifier("E").subscript(M::identifier("loc")); };
    const auto conjugate_log_derivative = []
    {
        return M::identifier("O")
            .subscript(M::symbol(S::theta))
            .superscript(M::symbol(S::asterisk));
    };
    const auto expectation = [](M expression)
    { return M::delimited(D::angle).body(std::move(expression)); };

    auto covariance = M::subtract(
        expectation(M::sequence().append(local_energy()).append(conjugate_log_derivative())),
        M::sequence()
            .append(expectation(local_energy()))
            .append(expectation(conjugate_log_derivative()))
    );

    return M::equal(
        M::sequence()
            .append(M::symbol(S::nabla).subscript(M::symbol(S::theta)))
            .append(M::identifier("E")),
        M::sequence()
            .append(M::integer(2))
            .append(M::named_operator("Re").argument(std::move(covariance)))
    );
}

auto make_sample_document()
{
    using namespace dans::document;
    using namespace dans::document::plugins;

    using M = dans::document::plugins::Math;
    using S = M::Symbol;

    Document document{Metadata{.major = 0, .minor = 1, .patch = 0}};
    document.set_preamble(
        Preamble{
            .title = "Document Core Experiment",
            .author = "Daniel",
            .date = "18 July 2026",
            .toc_enabled = true,
        }
    );

    const auto par_writer = [&](BlockSequence& blocks, std::string_view text)
    { blocks.add<CoreParagraph>(text); };

    auto& introduction = document.blocks().add<Section>("Introduction");
    par_writer(
        introduction.blocks(),
        "This document is represented as an owning C++ object model and exported through a "
        "separate LaTeX writer."
    );

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
    auto& inline_paragraph = inline_extensions.blocks().add<CoreParagraph>();
    inline_paragraph.append_text("A paragraph can combine ordinary text, inline math such as ");
    inline_paragraph.inlines().add<Math::Inline>(
        M::identifier("x").subscript(M::identifier("i")).superscript(M::integer(2))
    );
    inline_paragraph.append_text(", and ");
    auto& color_span =
        inline_paragraph.inlines().add<ColorSpan>(RgbColor{.red = 38, .green = 96, .blue = 168});
    color_span.inlines().add<CoreText>("a coloured span containing both text and ");
    color_span.inlines().add<Math::Inline>(M::add(M::symbol(S::alpha), M::symbol(S::beta)));
    inline_paragraph.append_text(", a tiny inline image ");
    inline_paragraph.inlines().add<InlineImage>(
        ImageSource{"sample-image.pdf"}, InlineImageHeight{1.1}
    );
    inline_paragraph.append_text(", and even a deliberate raw LaTeX escape hatch such as ");
    inline_paragraph.inlines().add<InlineLatex>(R"(\LaTeX{})");
    inline_paragraph.append_text(" in one ordered inline sequence.");

    auto& escaping = architecture.blocks().add<Section>("Backend-owned escaping");
    escaping.blocks().add<CoreParagraph>(
        "The paragraph model stores ordinary text such as CUDA & C++, block_size, and 50% "
        "without containing LaTeX escape sequences."
    );
    par_writer(
        architecture.blocks(),
        "Because sections share the same ordered block sequence as ordinary content, this "
        "paragraph can appear after the preceding subsections."
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
    figure.caption().add<CoreText>(" Captions share the inline contract, including ");
    figure.caption().add<Math::Inline>(M::add(M::symbol(S::alpha), M::symbol(S::beta)));
    figure.caption().add<CoreText>(".");

    auto& figure_reference = media.blocks().add<CoreParagraph>();
    figure_reference.append_text("The visible number in ");
    figure_reference.inlines().add<Reference>(sample_figure_id);
    figure_reference.append_text(
        " belongs to the exporter, while the document model retains only its stable ID."
    );

    auto& mathematics = document.blocks().add<Section>("Display mathematics");
    par_writer(
        mathematics.blocks(),
        "These two aligned, independently numbered equations are represented by a recursive "
        "structured-math tree rather than stored as LaTeX source."
    );
    const ReferenceId energy_equation_id{"eq:energy"};
    const ReferenceId gradient_equation_id{"eq:gradient"};
    mathematics.blocks()
        .add<M::Display>(make_energy_equation(), energy_equation_id)
        .add_equation(make_gradient_equation(), gradient_equation_id);

    auto& equation_references = mathematics.blocks().add<CoreParagraph>();
    equation_references.append_text("The aligned group retains distinct targets: ");
    equation_references.inlines().add<Reference>(energy_equation_id);
    equation_references.append_text(" and ");
    equation_references.inlines().add<Reference>(gradient_equation_id);
    equation_references.append_text(".");

    auto& latex_escape = document.blocks().add<Section>("LaTeX escape hatch");
    par_writer(
        latex_escape.blocks(),
        "Raw LaTeX remains available as an explicitly backend-specific mixin, not as mathematics."
    );
    latex_escape.blocks().add<LatexBlock>(
        R"(\begin{center}\textit{This block bypasses the semantic model.}\end{center})"
    );

    return document;
}
}  // namespace

auto main(const int argc, char* argv[]) -> int
{
    if (argc > 2)
    {
        std::cerr << "Usage: document_example [output.tex]\n";
        return EXIT_FAILURE;
    }

    const auto output_path =
        argc == 2 ? std::filesystem::path{argv[1]} : std::filesystem::path{"sample-document.tex"};

    try
    {
        std::cout << "Hello Typesetter!\n";
        const auto document = make_sample_document();
        dans::document::writers::LatexWriter writer;
        auto inline_renderer =
            std::make_shared<dans::document::connectors::latex::CoreParagraphInlineLatexRenderer>();
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::CoreTextLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::InlineMathLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::InlineLatexAdapter>()
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
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::CoreParagraphLatexAdapter>(
                inline_renderer
            )
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::DisplayMathLatexAdapter>()
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::FigureLatexAdapter>(inline_renderer)
        );
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::LatexBlockAdapter>()
        );
        writer.write_file(document, output_path);
        std::cout << "Wrote LaTeX document: " << output_path.string() << '\n';
    }
    catch (const std::exception& error)
    {
        std::cerr << "Failed to serialize document: " << error.what() << '\n';
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}
