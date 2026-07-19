// src/connectors/markdown/document_shell.cpp — lower title, ToC, and page intent.
#include "connectors/markdown/document_shell.hpp"

#include <stdexcept>

namespace dans::document::connectors::markdown
{
auto TitlePageMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::TitlePage::k_type_id;
}

auto TitlePageMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* title_page = dynamic_cast<const plugins::TitlePage*>(&block);
    if (title_page == nullptr)
    {
        throw std::invalid_argument{"The title-page adapter received a different block type"};
    }
    output.write_raw("# ");
    output.write_text(title_page->title());
    output.write_raw("\n\n**");
    output.write_text(title_page->author());
    output.write_raw("**  \n");
    output.write_text(title_page->date());
    output.write_raw("\n\n");
}

auto TableOfContentsMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::TableOfContents::k_type_id;
}

auto TableOfContentsMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    if (dynamic_cast<const plugins::TableOfContents*>(&block) == nullptr)
    {
        throw std::invalid_argument{
            "The table-of-contents adapter received a different block type"
        };
    }
    output.write_table_of_contents();
}

auto PageBreakMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::PageBreak::k_type_id;
}

auto PageBreakMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    if (dynamic_cast<const plugins::PageBreak*>(&block) == nullptr)
    {
        throw std::invalid_argument{"The page-break adapter received a different block type"};
    }
    output.write_raw(
        "<div class=\"dans-page-break\" style=\"break-after: page; "
        "page-break-after: always;\"></div>\n\n"
    );
}
}  // namespace dans::document::connectors::markdown
