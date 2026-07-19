// tests/native_document_shell_test.cpp — verify ordinary shell blocks and section labels.
#include "connectors/latex/document_shell.hpp"
#include "document.hpp"
#include "plugins/document_shell.hpp"
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

auto render_shell() -> std::string
{
    using namespace dans::document;
    using namespace dans::document::plugins;

    Document document{Metadata{.major = 1, .minor = 2, .patch = 3}};
    document.blocks().add<TitlePage>("A & B", "Daniel", "July 2026");
    document.blocks().add<TableOfContents>();
    document.blocks().add<PageBreak>();
    document.blocks().add<Section>("Results & discussion", ReferenceId{"sec:results"});

    writers::LatexWriter writer;
    writer.register_block_adapter(std::make_unique<connectors::latex::TitlePageLatexAdapter>());
    writer.register_block_adapter(
        std::make_unique<connectors::latex::TableOfContentsLatexAdapter>()
    );
    writer.register_block_adapter(std::make_unique<connectors::latex::PageBreakLatexAdapter>());
    std::ostringstream output;
    writer.serialize(document, output);
    return output.str();
}

auto verify_invalid_title_page() -> void
{
    auto rejected = false;
    try
    {
        [[maybe_unused]] dans::document::plugins::TitlePage title_page{"", "Daniel", "today"};
    }
    catch (const std::invalid_argument&)
    {
        rejected = true;
    }
    if (!rejected)
    {
        throw std::runtime_error{"An empty title page field was accepted"};
    }
}
}  // namespace

auto main() noexcept -> int
{
    try
    {
        const auto rendered = render_shell();
        expect_contains(rendered, "\\begin{titlepage}", "title-page environment");
        expect_contains(rendered, "\\hypersetup{pageanchor=false}", "title-page anchor isolation");
        expect_contains(rendered, "A \\& B", "title escaping");
        expect_contains(rendered, "\\tableofcontents", "table of contents");
        expect_contains(rendered, "\\clearpage", "page break");
        expect_contains(rendered, "\\section{Results \\& discussion}", "section heading");
        expect_contains(rendered, "\\label{sec:results}", "section reference target");
        verify_invalid_title_page();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_document_shell_test failed: {}", error.what());
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
