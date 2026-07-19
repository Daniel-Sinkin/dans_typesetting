// tests/native_inline_test.cpp — exercise semantic prose through the LaTeX connector boundary.
#include "connectors/latex/core_paragraph.hpp"
#include "connectors/latex/footnote.hpp"
#include "connectors/latex/hyperlink.hpp"
#include "connectors/latex/inline_code.hpp"
#include "document.hpp"
#include "plugins/core_paragraph.hpp"
#include "plugins/footnote.hpp"
#include "plugins/hyperlink.hpp"
#include "plugins/inline_code.hpp"
#include "writers/latex_writer.hpp"

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
    paragraph.append_text("; note");
    auto& footnote = paragraph.inlines().add<Footnote>();
    footnote.append_text("See ");
    auto& footnote_link = footnote.inlines().add<Hyperlink>("https://example.com/source");
    footnote_link.label().add<CoreText>("source", TextStyle::italic);
    paragraph.append_text("; code ");
    paragraph.inlines().add<InlineCode>(R"(block_size<&>{}_50%$#~^\)");

    auto inline_renderer =
        std::make_shared<dans::document::connectors::latex::CoreParagraphInlineLatexRenderer>();
    inline_renderer->register_inline_adapter(
        std::make_unique<dans::document::connectors::latex::CoreTextLatexAdapter>()
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

auto expect_invalid_footnote_content() -> void
{
    using namespace dans::document;
    using namespace dans::document::plugins;

    const auto rejected = [](const bool nested)
    {
        Document document{Metadata{.major = 1, .minor = 0, .patch = 0}};
        auto& paragraph = document.blocks().add<CoreParagraph>("Text");
        auto& footnote = paragraph.inlines().add<Footnote>();
        if (nested)
        {
            footnote.inlines().add<Footnote>("Nested");
        }

        auto inline_renderer =
            std::make_shared<dans::document::connectors::latex::CoreParagraphInlineLatexRenderer>();
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::CoreTextLatexAdapter>()
        );
        inline_renderer->register_inline_adapter(
            std::make_unique<dans::document::connectors::latex::FootnoteLatexAdapter>()
        );
        dans::document::writers::LatexWriter writer;
        writer.register_block_adapter(
            std::make_unique<dans::document::connectors::latex::CoreParagraphLatexAdapter>(
                inline_renderer
            )
        );
        std::ostringstream output;
        try
        {
            writer.serialize(document, output);
        }
        catch (const std::invalid_argument&)
        {
            return true;
        }
        return false;
    };

    if (!rejected(false) || !rejected(true))
    {
        throw std::runtime_error{"An empty or directly nested footnote was accepted"};
    }
}

auto expect_invalid_inline_code() -> void
{
    using dans::document::plugins::InlineCode;

    const InlineCode empty_code{""};
    if (empty_code.type_id() != InlineCode::k_type_id || !empty_code.code().empty())
    {
        throw std::runtime_error{"An empty transient inline-code value was not preserved"};
    }

    for (const std::string_view code : {"first\nsecond", "first\rsecond"})
    {
        auto rejected = false;
        try
        {
            [[maybe_unused]] InlineCode inline_code{code};
        }
        catch (const std::invalid_argument&)
        {
            rejected = true;
        }
        if (!rejected)
        {
            throw std::runtime_error{"Inline code with a line break was accepted"};
        }
    }
}
}  // namespace

auto main() noexcept -> int
{
    try
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
        expect_contains(
            rendered,
            R"(\footnote{See \href{https://example.com/source}{\textit{source}}})",
            "semantic footnote"
        );
        expect_contains(
            rendered,
            R"(\texttt{block\_size<\&>\{\}\_50\%\$\#\textasciitilde{}\textasciicircum{}\textbackslash{}})",
            "escaped semantic inline code"
        );
        expect_invalid_hyperlink_targets();
        expect_invalid_footnote_content();
        expect_invalid_inline_code();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_inline_test failed: {}", error.what());
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
