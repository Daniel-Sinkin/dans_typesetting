// src/connectors/latex/document_shell.hpp — LaTeX adapters for document-shell blocks.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_DOCUMENT_SHELL_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_DOCUMENT_SHELL_HPP

#include "plugins/document_shell.hpp"
#include "writers/latex_writer.hpp"

#include <string_view>

namespace dans::document::connectors::latex
{
class TitlePageLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;
};

class TableOfContentsLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;
};

class PageBreakLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_DOCUMENT_SHELL_HPP
