// Verify scoped LaTeX-math semantics through LaTeX and Markdown connectors.
#include "connectors/latex/latex_math.hpp"
#include "connectors/latex/paragraph.hpp"
#include "connectors/markdown/latex_math.hpp"
#include "connectors/markdown/paragraph.hpp"
#include "document.hpp"
#include "plugins/latex_math.hpp"
#include "plugins/paragraph.hpp"
#include "reference_id.hpp"
#include "writers/latex_writer.hpp"
#include "writers/markdown_writer.hpp"

#include <memory>
#include <print>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>

namespace
{
auto expect_contains(
    const std::string_view rendered, const std::string_view expected, const std::string_view context
) -> void
{
    if (!rendered.contains(expected))
    {
        throw std::runtime_error{
            std::string{context} + ": expected output to contain " + std::string{expected}
        };
    }
}

auto make_document() -> dans::document::Document
{
    using namespace dans::document;
    using namespace dans::document::plugins;

    Document document{Metadata{.major = 1, .minor = 0, .patch = 0}};
    auto& paragraph = document.blocks().add<Paragraph>("Energy ");
    paragraph.inlines().add<LatexMathInline>(R"(E = mc^2)");
    paragraph.append_text(" is inline.");
    document.blocks().add<LatexMathDisplay>(
        R"(\mathcal{Z}(\beta) = \operatorname{Tr}\!\left(e^{-\beta H}\right))",
        LatexMathNumbering::numbered,
        ReferenceId{"eq:partition-function"}
    );
    document.blocks().add<LatexMathDisplay>(
        R"(\rho = \frac{e^{-\beta H}}{\mathcal{Z}})", LatexMathNumbering::unnumbered
    );
    return document;
}

auto render_latex() -> std::string
{
    using namespace dans::document::connectors::latex;

    auto inline_renderer = std::make_shared<InlineLatexRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<TextLatexAdapter>());
    inline_renderer->register_inline_adapter(std::make_unique<LatexMathInlineAdapter>());
    dans::document::writers::LatexWriter writer;
    writer.register_block_adapter(std::make_unique<ParagraphLatexAdapter>(inline_renderer));
    writer.register_block_adapter(std::make_unique<LatexMathDisplayAdapter>());
    std::ostringstream output;
    writer.serialize(make_document(), output);
    return output.str();
}

auto render_markdown() -> std::string
{
    using namespace dans::document::connectors::markdown;

    auto inline_renderer = std::make_shared<InlineMarkdownRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<TextMarkdownAdapter>());
    inline_renderer->register_inline_adapter(std::make_unique<LatexMathInlineMarkdownAdapter>());
    dans::document::writers::MarkdownWriter writer;
    writer.register_block_adapter(std::make_unique<ParagraphMarkdownAdapter>(inline_renderer));
    writer.register_block_adapter(std::make_unique<LatexMathDisplayMarkdownAdapter>());
    std::ostringstream output;
    writer.serialize(make_document(), output);
    return output.str();
}

template <typename Action>
auto expect_invalid(Action&& action, const std::string_view context) -> void
{
    try
    {
        action();
    }
    catch (const std::invalid_argument&)
    {
        return;
    }
    throw std::runtime_error{std::string{context} + ": invalid value was accepted"};
}

auto verify_validation() -> void
{
    using namespace dans::document;
    using namespace dans::document::plugins;

    expect_invalid([] { LatexMathInline value{""}; }, "empty inline math");
    expect_invalid([] { LatexMathInline value{"x $ y"}; }, "explicit inline delimiter");
    expect_invalid([] { LatexMathInline value{"x\ny"}; }, "multiline inline math");
    expect_invalid([] { LatexMathDisplay value{"$$x$$"}; }, "explicit display delimiter");
    expect_invalid(
        []
        { LatexMathDisplay value{"x", LatexMathNumbering::unnumbered, ReferenceId{"eq:invalid"}}; },
        "unnumbered reference target"
    );
}
}  // namespace

auto main() noexcept -> int
{
    try
    {
        const auto latex = render_latex();
        expect_contains(latex, R"(Energy $E = mc^2$ is inline.)", "LaTeX inline math");
        expect_contains(latex, R"(\begin{equation})", "numbered LaTeX display");
        expect_contains(latex, R"(\label{eq:partition-function})", "LaTeX equation target");
        expect_contains(latex, R"(\[)", "unnumbered LaTeX display");

        const auto markdown = render_markdown();
        expect_contains(markdown, R"(Energy $E = mc^2$ is inline\.)", "Markdown inline math");
        expect_contains(markdown, "<a id=\"eq:partition-function\"></a>", "Markdown target");
        expect_contains(markdown, "*Equation 1*", "Markdown equation number");
        expect_contains(markdown, "$$\n\\rho", "Markdown display delimiters");
        verify_validation();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println(stderr, "native_latex_math_test failed: {}", error.what());
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
