// src/connectors/markdown/bibliography.hpp — connect citations and references to Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_BIBLIOGRAPHY_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_BIBLIOGRAPHY_HPP

#include "connectors/markdown/inline_sequence.hpp"
#include "plugins/bibliography.hpp"

namespace dans::document::connectors::markdown
{
inline constexpr std::string_view k_bibliography_resource_namespace{"dans.bibliography.entry"};

class CitationMarkdownAdapter final : public InlineMarkdownAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineMarkdownOutput& output) const
        -> void override;
};

class BibliographyMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto resources(const DocumentBlock& block) const
        -> std::vector<writers::MarkdownResourceDescriptor> override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_BIBLIOGRAPHY_HPP
