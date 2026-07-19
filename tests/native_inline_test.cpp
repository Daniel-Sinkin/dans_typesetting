// tests/native_inline_test.cpp — exercise semantic prose through the LaTeX connector boundary.
#include "connectors/latex/core_paragraph.hpp"
#include "connectors/latex/hyperlink.hpp"
#include "document.hpp"
#include "plugins/core_paragraph.hpp"
#include "plugins/hyperlink.hpp"
#include "writers/latex_writer.hpp"

#include <memory>
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
            std::string{context} + ": expected rendered LaTeX to contain " + std::string{expected}
        };
    }
}

auto render_sample() -> std::string
{
    using namespace dans::document;
    using namespace dans::document::plugins;

    Document document{Metadata{.major = 1, .minor = 0, .patch = 0}};
    auto& paragraph = document.blocks().add<CoreParagraph>();
    paragraph.append_text("plain & safe; ");
    paragraph.append_text("bold", TextStyle::bold);
    paragraph.append_text("; ");
    paragraph.append_text("italic", TextStyle::italic);
    paragraph.append_text("; ");
    paragraph.append_text("both", TextStyle::bold_italic);
    paragraph.append_text("; ");
    paragraph.inlines().add<Hyperlink>("https://example.com/a_b?x=1&y=2#result");
    paragraph.append_text("; ");
    auto& labelled = paragraph.inlines().add<Hyperlink>("www.example.com/results");
    labelled.label().add<CoreText>("label", TextStyle::bold);

    auto inline_renderer =
        std::make_shared<dans::document::connectors::latex::CoreParagraphInlineLatexRenderer>();
    inline_renderer->register_inline_adapter(
        std::make_unique<dans::document::connectors::latex::CoreTextLatexAdapter>()
    );
    inline_renderer->register_inline_adapter(
        std::make_unique<dans::document::connectors::latex::HyperlinkLatexAdapter>()
    );

    dans::document::writers::LatexWriter writer;
    writer.register_block_adapter(
        std::make_unique<dans::document::connectors::latex::CoreParagraphLatexAdapter>(
            inline_renderer
        )
    );
    std::ostringstream output;
    writer.serialize(document, output);
    return output.str();
}

auto expect_invalid_hyperlink_targets() -> void
{
    using dans::document::plugins::Hyperlink;

    for (const std::string_view target : {"", "contains whitespace", "bad{target}", R"(bad\path)"})
    {
        auto rejected = false;
        try
        {
            [[maybe_unused]] Hyperlink link{target};
        }
        catch (const std::invalid_argument&)
        {
            rejected = true;
        }
        if (!rejected)
        {
            throw std::runtime_error{
                "Invalid hyperlink target was accepted: " + std::string{target}
            };
        }
    }
}
}  // namespace

auto main() -> int
{
    const auto rendered = render_sample();
    expect_contains(rendered, "plain \\& safe", "ordinary text escaping");
    expect_contains(rendered, "\\textbf{bold}", "bold Core Text");
    expect_contains(rendered, "\\textit{italic}", "italic Core Text");
    expect_contains(rendered, "\\textbf{\\textit{both}}", "bold italic Core Text");
    expect_contains(
        rendered,
        "\\href{https://example.com/a\\_b?x=1\\&y=2\\#result}{https://example.com/"
        "a\\_b?x=1\\&y=2\\#result}",
        "visible hyperlink target"
    );
    expect_contains(
        rendered, "\\href{www.example.com/results}{\\textbf{label}}", "styled hyperlink label"
    );
    expect_invalid_hyperlink_targets();
    return 0;
}
