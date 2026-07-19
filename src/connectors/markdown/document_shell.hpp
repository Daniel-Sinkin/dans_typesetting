// src/connectors/markdown/document_shell.hpp — connect shell blocks to Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_DOCUMENT_SHELL_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_DOCUMENT_SHELL_HPP

#include "plugins/document_shell.hpp"
#include "writers/markdown_writer.hpp"

namespace dans::document::connectors::markdown
{
class TitlePageMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;
};

class TableOfContentsMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;
};

class PageBreakMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_DOCUMENT_SHELL_HPP
