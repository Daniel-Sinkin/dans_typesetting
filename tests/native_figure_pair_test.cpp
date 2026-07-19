// Verify the opinionated two-panel figure contract in both text writers.
#include "connectors/latex/core_paragraph.hpp"
#include "connectors/latex/figure_pair.hpp"
#include "connectors/latex/image.hpp"
#include "connectors/markdown/core_paragraph.hpp"
#include "connectors/markdown/figure_pair.hpp"
#include "connectors/markdown/image.hpp"
#include "connectors/markdown/reference.hpp"
#include "document.hpp"
#include "plugins/core_paragraph.hpp"
#include "plugins/figure_pair.hpp"
#include "plugins/reference.hpp"
#include "reference_id.hpp"
#include "writers/latex_writer.hpp"
#include "writers/markdown_writer.hpp"

#include <exception>
#include <memory>
#include <optional>
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

template <typename Function>
auto expect_invalid_argument(Function&& function, const std::string_view message) -> void
{
    auto rejected = false;
    try
    {
        std::forward<Function>(function)();
    }
    catch (const std::invalid_argument&)
    {
        rejected = true;
    }
    expect(rejected, message);
}

auto add_pair(
    Document& document,
    const std::string_view prefix,
    const bool reference_second_panel = true,
    const bool reference_group = true
) -> FigurePair&
{
    auto first = FigurePanel{
        ImageSource{std::string{prefix} + "-left.png"},
        "Left panel",
        ReferenceId{std::string{prefix} + ":left"},
        PixelExtent{1280, 720},
    };
    first.caption().add<CoreText>(" with emphasis", TextStyle::italic);
    auto second_reference =
        reference_second_panel
            ? std::optional<ReferenceId>{ReferenceId{std::string{prefix} + ":right"}}
            : std::nullopt;
    auto group_reference =
        reference_group ? std::optional<ReferenceId>{ReferenceId{std::string{prefix} + ":pair"}}
                        : std::nullopt;
    return document.blocks().add<FigurePair>(
        std::move(first),
        FigurePanel{
            ImageSource{std::string{prefix} + "-right.png"},
            "Right panel",
            std::move(second_reference),
        },
        std::move(group_reference),
        "Joint result",
        RelativeWidth::from_percent(47.5)
    );
}

auto render_latex(const Document& document) -> std::string
{
    auto inline_renderer = std::make_shared<latex::CoreParagraphInlineLatexRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<latex::CoreTextLatexAdapter>());
    writers::LatexWriter writer{};
    writer.register_block_adapter(std::make_unique<latex::FigureLatexAdapter>(inline_renderer));
    writer.register_block_adapter(std::make_unique<latex::FigurePairLatexAdapter>(inline_renderer));
    std::ostringstream output{};
    writer.serialize(document, output);
    return output.str();
}

auto render_markdown(const Document& document) -> std::string
{
    auto inline_renderer = std::make_shared<markdown::CoreParagraphInlineMarkdownRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<markdown::CoreTextMarkdownAdapter>());
    inline_renderer->register_inline_adapter(
        std::make_unique<markdown::ReferenceMarkdownAdapter>()
    );
    writers::MarkdownWriter writer{};
    writer.register_block_adapter(
        std::make_unique<markdown::FigureMarkdownAdapter>(inline_renderer)
    );
    writer.register_block_adapter(
        std::make_unique<markdown::FigurePairMarkdownAdapter>(inline_renderer)
    );
    writer.register_block_adapter(
        std::make_unique<markdown::CoreParagraphMarkdownAdapter>(inline_renderer)
    );
    std::ostringstream output{};
    writer.serialize(document, output);
    return output.str();
}

auto run_test() -> void
{
    Document document{};
    auto& first = add_pair(document, "fig:first");
    expect(
        first.panels().size() == dans::usize{2}, "A figure pair did not retain exactly two panels"
    );
    const auto& preferred_extent = first.panels()[0].preferred_pixel_extent();
    if (!preferred_extent.has_value())
    {
        throw std::runtime_error{"A panel lost its preferred pixel extent"};
    }
    expect(
        preferred_extent.value().width() == dans::u32{1280},
        "A panel changed its preferred pixel width"
    );
    add_pair(document, "fig:second", false, false);
    auto& standalone = document.blocks().add<Figure>(
        ImageSource{"fig:standalone.png"}, "Standalone result", RelativeWidth::from_percent(75.0)
    );
    expect(!standalone.reference_id().has_value(), "An unreferenced figure acquired a target");

    const auto latex_output = render_latex(document);
    expect(latex_output.contains("\\usepackage{subcaption}"), "subcaption was not configured");
    expect(
        latex_output.contains("\\begin{subfigure}[t]{0.475\\linewidth}"),
        "The panel width was not lowered relative to the line width"
    );
    expect(
        latex_output.contains("\\includegraphics[width=\\linewidth]{fig:first-left.png}"),
        "The first panel image was not emitted"
    );
    expect(
        latex_output.contains("\\caption{Left panel\\textit{ with emphasis}}"),
        "A rich panel caption did not use the inline renderer"
    );
    expect(
        latex_output.contains("\\label{fig:first:left}"),
        "The first panel reference target was not emitted"
    );
    expect(
        latex_output.contains("\\label{fig:first:pair}"),
        "The group reference target was not emitted"
    );
    expect(
        !latex_output.contains("\\label{fig:second:pair}"),
        "An unreferenced pair emitted a synthetic group target"
    );
    expect(
        latex_output.contains("\\caption{Standalone result}\n\\end{figure}"),
        "An unreferenced ordinary figure did not remain a numbered captioned figure"
    );

    auto& references = document.blocks().add<CoreParagraph>("Compare ");
    references.inlines().add<Reference>(ReferenceId{"fig:first:pair"});
    references.append_text(", ");
    references.inlines().add<Reference>(ReferenceId{"fig:first:left"});
    references.append_text(", and ");
    references.inlines().add<Reference>(ReferenceId{"fig:first:right"});
    references.append_text(", plus ");
    references.inlines().add<Reference>(ReferenceId{"fig:second:left"});
    references.append_text(".");

    const auto markdown_output = render_markdown(document);
    expect(
        markdown_output.contains("| ![](<fig:first-left.png>) | ![](<fig:first-right.png>) |"),
        "The Markdown writer did not retain both panels"
    );
    expect(
        markdown_output.contains("*Figure 1: Joint result*"),
        "The first pair did not consume exactly one figure number"
    );
    expect(
        markdown_output.contains("*Figure 2: Joint result*"),
        "The unreferenced pair did not consume the next figure number"
    );
    expect(
        markdown_output.contains("*Figure 3: Standalone result*"),
        "The unreferenced ordinary figure did not share the figure numbering series"
    );
    expect(
        markdown_output.contains("[Figure 1](#fig:first:pair)"),
        "The group reference did not resolve"
    );
    expect(
        markdown_output.contains("[Figure 1a](#fig:first:left)"),
        "The first panel reference did not receive its subfigure suffix"
    );
    expect(
        markdown_output.contains("[Figure 1b](#fig:first:right)"),
        "The second panel reference did not receive its subfigure suffix"
    );
    expect(
        markdown_output.contains("[Figure 2a](#fig:second:left)"),
        "A panel target lost the group ordinal when the group had no target"
    );
    expect(
        !markdown_output.contains("id=\"fig:second:pair\""),
        "An unreferenced pair emitted a Markdown anchor"
    );

    expect_invalid_argument(
        [] { static_cast<void>(FigurePanel{ImageSource{"panel.png"}, ""}); },
        "A panel accepted an empty caption"
    );
    expect_invalid_argument(
        []
        {
            static_cast<void>(FigurePair{
                FigurePanel{ImageSource{"left.png"}, "Left"},
                FigurePanel{ImageSource{"right.png"}, "Right"},
                ReferenceId{"fig:invalid"},
                "Pair",
                RelativeWidth::from_percent(51.0),
            });
        },
        "A pair accepted panels wider than half the available width"
    );
    expect_invalid_argument(
        []
        {
            static_cast<void>(FigurePair{
                FigurePanel{ImageSource{"left.png"}, "Left", ReferenceId{"fig:duplicate"}},
                FigurePanel{ImageSource{"right.png"}, "Right"},
                ReferenceId{"fig:duplicate"},
                "Pair",
            });
        },
        "A pair accepted duplicate group and panel targets"
    );
    expect_invalid_argument(
        []
        {
            static_cast<void>(FigurePair{
                FigurePanel{ImageSource{"left.png"}, "Left"},
                FigurePanel{ImageSource{"right.png"}, "Right"},
                ReferenceId{"fig:empty-caption"},
                "",
            });
        },
        "A pair accepted an empty group caption"
    );
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
            std::println("native_figure_pair_test failed: {}", error.what());
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
