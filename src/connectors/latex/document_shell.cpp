// src/connectors/latex/document_shell.cpp — render document-shell blocks as LaTeX.
#include "connectors/latex/document_shell.hpp"

#include <stdexcept>

namespace dans::document::connectors::latex
{
auto TitlePageLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::TitlePage::k_type_id;
}

auto TitlePageLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    const auto* title_page = dynamic_cast<const plugins::TitlePage*>(&block);
    if (title_page == nullptr)
    {
        throw std::invalid_argument{"The title-page adapter received a different block type"};
    }

    output.write_raw(
        "\\hypersetup{pageanchor=false}\n\\begin{titlepage}\n\\centering\n"
        "\\vspace*{\\fill}\n{\\Huge\\bfseries "
    );
    output.write_text(title_page->title());
    output.write_raw("\\par}\n\\vspace{1.5cm}\n{\\Large ");
    output.write_text(title_page->author());
    output.write_raw("\\par}\n\\vspace{1cm}\n{\\large ");
    output.write_text(title_page->date());
    output.write_raw(
        "\\par}\n\\vspace*{\\fill}\n\\end{titlepage}\n"
        "\\hypersetup{pageanchor=true}\n\n"
    );
}

auto TableOfContentsLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::TableOfContents::k_type_id;
}

auto TableOfContentsLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    if (dynamic_cast<const plugins::TableOfContents*>(&block) == nullptr)
    {
        throw std::invalid_argument{
            "The table-of-contents adapter received a different block type"
        };
    }
    output.write_raw("\\tableofcontents\n\n");
}

auto PageBreakLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::PageBreak::k_type_id;
}

auto PageBreakLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    if (dynamic_cast<const plugins::PageBreak*>(&block) == nullptr)
    {
        throw std::invalid_argument{"The page-break adapter received a different block type"};
    }
    output.write_raw("\\clearpage\n\n");
}
}  // namespace dans::document::connectors::latex
