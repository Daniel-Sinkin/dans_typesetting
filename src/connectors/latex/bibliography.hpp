// src/connectors/latex/bibliography.hpp — lower citations and references to LaTeX.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_BIBLIOGRAPHY_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_BIBLIOGRAPHY_HPP

#include "connectors/latex/inline_sequence.hpp"
#include "writers/latex_writer.hpp"

#include <string_view>

namespace dans::document::connectors::latex
{
class CitationLatexAdapter final : public InlineLatexAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineLatexOutput& output) const
        -> void override;
};

class BibliographyLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_BIBLIOGRAPHY_HPP
