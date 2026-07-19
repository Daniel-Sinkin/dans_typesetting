// Verify generic captions and writer-resolved Python plots as one complete slice.
#include "connectors/latex/captioned.hpp"
#include "connectors/latex/image.hpp"
#include "connectors/latex/paragraph.hpp"
#include "connectors/latex/python_plot.hpp"
#include "connectors/latex/reference.hpp"
#include "connectors/markdown/captioned.hpp"
#include "connectors/markdown/image.hpp"
#include "connectors/markdown/paragraph.hpp"
#include "connectors/markdown/python_plot.hpp"
#include "connectors/markdown/reference.hpp"
#include "document.hpp"
#include "plugins/captioned.hpp"
#include "plugins/image.hpp"
#include "plugins/paragraph.hpp"
#include "plugins/python_plot.hpp"
#include "plugins/reference.hpp"
#include "reference_id.hpp"
#include "writers/latex_writer.hpp"
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
    document.blocks().add<Figure>(ImageSource{"legacy.png"}, "Legacy figure");

    auto& plot = document.blocks().add<Captioned>(
        "Figure", "Generated result", ReferenceId{"fig:generated"}
    );
    auto& source = plot.set_content<PythonPlot>(
        "figure, axis = plt.subplots()\naxis.plot([1, 2], [3, 4])\n",
        RelativeWidth::from_percent(75.0),
        PixelExtent{960, 540}
    );
    expect(source.target_pixel_extent().width() == dans::u32{960}, "Plot width was lost");
    expect(source.target_pixel_extent().height() == dans::u32{540}, "Plot height was lost");

    auto& custom = document.blocks().add<Captioned>(
        "Example*", "Custom counter", ReferenceId{"example:custom"}
    );
    custom.set_content<PythonPlot>("plt.plot([0, 1], [0, 1])");

    auto& naked_caption = document.blocks().add<Captioned>(std::nullopt, "An unnumbered note");
    naked_caption.set_content<PythonPlot>("plt.scatter([0], [1])");

    auto& reference = document.blocks().add<Paragraph>("See ");
    reference.inlines().add<Reference>(ReferenceId{"fig:generated"});
    reference.append_text(" and ");
    reference.inlines().add<Reference>(ReferenceId{"example:custom"});
    reference.append_text(".");
    return document;
}

auto render_latex(const Document& document) -> std::string
{
    auto inline_renderer = std::make_shared<latex::InlineLatexRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<latex::TextLatexAdapter>());
    inline_renderer->register_inline_adapter(std::make_unique<latex::ReferenceLatexAdapter>());
    writers::LatexWriter writer{};
    writer.register_block_adapter(std::make_unique<latex::FigureLatexAdapter>(inline_renderer));
    writer.register_block_adapter(std::make_unique<latex::CaptionedLatexAdapter>(inline_renderer));
    writer.register_block_adapter(
        std::make_unique<latex::PythonPlotLatexAdapter>(
            [](const PythonPlot&) { return std::filesystem::path{"generated plot.pdf"}; }
        )
    );
    writer.register_block_adapter(std::make_unique<latex::ParagraphLatexAdapter>(inline_renderer));
    std::ostringstream output{};
    writer.serialize(document, output);
    return output.str();
}

auto render_markdown(const Document& document) -> std::string
{
    auto inline_renderer = std::make_shared<markdown::InlineMarkdownRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<markdown::TextMarkdownAdapter>());
    inline_renderer->register_inline_adapter(
        std::make_unique<markdown::ReferenceMarkdownAdapter>()
    );
    writers::MarkdownWriter writer{};
    writer.register_block_adapter(
        std::make_unique<markdown::FigureMarkdownAdapter>(inline_renderer)
    );
    writer.register_block_adapter(
        std::make_unique<markdown::CaptionedMarkdownAdapter>(inline_renderer)
    );
    writer.register_block_adapter(
        std::make_unique<markdown::PythonPlotMarkdownAdapter>(
            [](const PythonPlot&) { return std::filesystem::path{"generated plot.svg"}; }
        )
    );
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
    const auto latex_output = render_latex(document);
    expect(
        latex_output.contains("\\includegraphics[width=0.75\\linewidth]{generated plot.pdf}"),
        "LaTeX lost the plot width or resolved asset"
    );
    expect(
        latex_output.contains("\\refstepcounter{figure}\\label{fig:generated}"),
        "LaTeX did not publish the generic Figure target"
    );
    expect(
        latex_output.contains("Figure~\\csname thefigure\\endcsname: Generated result"),
        "LaTeX did not render the generated Figure caption"
    );
    expect(
        latex_output.contains("\\newcounter{danscaption4578616d706c652a}"),
        "LaTeX did not injectively define the custom Example* counter"
    );
    expect(latex_output.contains("An unnumbered note"), "LaTeX lost an unnumbered rich caption");

    const auto markdown_output = render_markdown(document);
    expect(
        markdown_output.contains("*Figure 1: Legacy figure*"),
        "The legacy Figure did not start the shared category series"
    );
    expect(
        markdown_output.contains("*Figure 2: Generated result*"),
        "Captioned did not share the Figure numbering series"
    );
    expect(
        markdown_output.contains("[Figure 2](#fig:generated)"),
        "The generic Captioned target did not resolve"
    );
    expect(
        markdown_output.contains("![](<generated plot.svg>)"),
        "Markdown lost the writer-resolved plot asset"
    );
    expect(
        markdown_output.contains("*Example\\* 1: Custom counter*"),
        "Markdown did not maintain an independent custom category series"
    );
    expect(
        markdown_output.contains("[Example\\* 1](#example:custom)"),
        "Markdown did not escape the dynamic category in a reference"
    );
    expect(
        markdown_output.contains("*An unnumbered note*"), "Markdown lost the unnumbered caption"
    );

    expect_throws<std::invalid_argument>(
        [] { static_cast<void>(Captioned{" Figure", "bad"}); },
        "Captioned accepted an untrimmed category"
    );
    expect_throws<std::invalid_argument>(
        [] { static_cast<void>(PythonPlot{" \n\t"}); }, "PythonPlot accepted whitespace-only source"
    );
    expect_throws<std::invalid_argument>(
        [] { static_cast<void>(PythonPlot{"plt.plot([])", {}, PixelExtent{63, 720}}); },
        "PythonPlot accepted a target smaller than its supported rendering boundary"
    );
    expect_throws<std::logic_error>(
        []
        {
            Document incomplete_document{};
            auto inline_renderer = std::make_shared<latex::InlineLatexRenderer>();
            inline_renderer->register_inline_adapter(std::make_unique<latex::TextLatexAdapter>());
            writers::LatexWriter writer{};
            writer.register_block_adapter(
                std::make_unique<latex::CaptionedLatexAdapter>(inline_renderer)
            );
            incomplete_document.blocks().add<Captioned>("Figure", "Missing content");
            std::ostringstream output{};
            writer.serialize(incomplete_document, output);
        },
        "The writer accepted Captioned without exactly one child"
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
            std::println("native_captioned_python_plot_test failed: {}", error.what());
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
