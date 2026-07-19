// Verify generic child traversal and Padding connectors across text writers.
#include "connectors/latex/padding.hpp"
#include "connectors/latex/paragraph.hpp"
#include "connectors/markdown/padding.hpp"
#include "connectors/markdown/paragraph.hpp"
#include "document.hpp"
#include "plugins/padding.hpp"
#include "plugins/paragraph.hpp"
#include "writers/latex_writer.hpp"
#include "writers/markdown_writer.hpp"

#include <exception>
#include <limits>
#include <memory>
#include <print>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>

namespace
{
namespace latex = dans::document::connectors::latex;
namespace markdown = dans::document::connectors::markdown;
using dans::document::Document;
using dans::document::plugins::Padding;
using dans::document::plugins::PaddingInsets;
using dans::document::plugins::Paragraph;

auto expect(const bool condition, const std::string_view message) -> void
{
    if (!condition)
    {
        throw std::runtime_error{std::string{message}};
    }
}

auto make_document() -> Document
{
    Document document{};
    auto& padding = document.blocks().add<Padding>(
        PaddingInsets{.top_em = 1.25, .right_em = 2.0, .bottom_em = 3.5, .left_em = 4.0}
    );
    padding.content().add<Paragraph>().append_text("Nested content.");
    return document;
}

auto render_latex(const Document& document) -> std::string
{
    auto inline_renderer = std::make_shared<latex::InlineLatexRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<latex::TextLatexAdapter>());
    dans::document::writers::LatexWriter writer{};
    writer.register_block_adapter(std::make_unique<latex::PaddingLatexAdapter>());
    writer.register_block_adapter(std::make_unique<latex::ParagraphLatexAdapter>(inline_renderer));
    std::ostringstream output{};
    writer.serialize(document, output);
    return output.str();
}

auto render_markdown(const Document& document) -> std::string
{
    auto inline_renderer = std::make_shared<markdown::InlineMarkdownRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<markdown::TextMarkdownAdapter>());
    dans::document::writers::MarkdownWriter writer{};
    writer.register_block_adapter(std::make_unique<markdown::PaddingMarkdownAdapter>());
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
    const auto& padding = dynamic_cast<const Padding&>(*document.blocks().blocks().front());
    expect(padding.child_sequence_count() == 1, "Padding lost its content endpoint");
    expect(padding.child_sequence_id(0) == "content", "Padding endpoint has the wrong ID");

    const auto latex_source = render_latex(document);
    expect(latex_source.contains("\\usepackage{changepage}"), "LaTeX omitted changepage");
    expect(
        latex_source.contains("\\vspace*{1.25em}\n\\begin{adjustwidth}{4em}{2em}"),
        "LaTeX lost Padding insets"
    );
    expect(latex_source.contains("Nested content."), "LaTeX lost nested content");
    expect(latex_source.contains("\\vspace*{3.5em}"), "LaTeX lost bottom Padding intent");

    const auto markdown_source = render_markdown(document);
    expect(markdown_source.contains(R"(Nested content\.)"), "Markdown lost nested content");
    expect(!markdown_source.contains("adjustwidth"), "Markdown leaked LaTeX Padding syntax");

    try
    {
        static_cast<void>(Padding{PaddingInsets{
            .top_em = std::numeric_limits<double>::infinity(),
        }});
    }
    catch (const std::invalid_argument&)
    {
        return;
    }
    throw std::runtime_error{"Padding accepted a non-finite inset"};
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
            std::println("native_padding_test failed: {}", error.what());
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
