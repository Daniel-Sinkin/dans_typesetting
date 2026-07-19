// src/connectors/latex/bibliography.cpp — render normalized references with working links.
#include "connectors/latex/bibliography.hpp"

#include "plugins/bibliography.hpp"

#include <stdexcept>
#include <string>

namespace
{
auto write_link_target(dans::document::writers::LatexOutput& output, const std::string_view target)
    -> void
{
    for (const char character : target)
    {
        switch (character)
        {
            case '#':
                output.write_raw("\\#");
                break;
            case '%':
                output.write_raw("\\%");
                break;
            case '&':
                output.write_raw("\\&");
                break;
            case '_':
                output.write_raw("\\_");
                break;
            default:
                output.write_raw(std::string_view{&character, 1});
                break;
        }
    }
}

auto write_sentence(dans::document::writers::LatexOutput& output, const std::string_view value)
    -> void
{
    if (value.empty())
    {
        return;
    }
    output.write_text(value);
    output.write_raw(". ");
}

auto write_entry(
    dans::document::writers::LatexOutput& output,
    const dans::document::plugins::BibliographyEntry& entry
) -> void
{
    output.write_raw("\\bibitem{");
    output.write_raw(entry.key().value());
    output.write_raw("}\n");

    for (dans::usize index{}; index < entry.authors().size(); ++index)
    {
        if (index != 0)
        {
            output.write_raw(index + dans::usize{1} == entry.authors().size() ? " and " : "; ");
        }
        output.write_text(entry.authors()[index]);
    }
    if (!entry.authors().empty())
    {
        output.write_raw(". ");
    }
    output.write_raw("\\textit{");
    output.write_text(entry.title());
    output.write_raw("}. ");
    write_sentence(output, entry.venue());
    write_sentence(output, entry.publisher());
    if (entry.year().has_value())
    {
        output.write_raw(std::to_string(*entry.year()));
        output.write_raw(". ");
    }
    if (!entry.doi().empty())
    {
        output.write_raw("\\href{https://doi.org/");
        write_link_target(output, entry.doi());
        output.write_raw("}{doi:");
        output.write_text(entry.doi());
        output.write_raw("}. ");
    }
    if (!entry.url().empty())
    {
        output.write_raw("\\href{");
        write_link_target(output, entry.url());
        output.write_raw("}{");
        output.write_text(entry.url());
        output.write_raw("}. ");
    }
    output.write_raw("\n");
}
}  // namespace

namespace dans::document::connectors::latex
{
auto CitationLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Citation::k_type_id;
}

auto CitationLatexAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphLatexOutput& output
) const -> void
{
    const auto* citation = dynamic_cast<const plugins::Citation*>(&node);
    if (citation == nullptr)
    {
        throw std::invalid_argument{"The citation adapter received a different inline type"};
    }

    output.write_raw("\\cite{");
    for (usize index{}; index < citation->keys().size(); ++index)
    {
        if (index != 0)
        {
            output.write_raw(",");
        }
        output.write_raw(citation->keys()[index].value());
    }
    output.write_raw("}");
}

auto BibliographyLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Bibliography::k_type_id;
}

auto BibliographyLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    const auto* bibliography = dynamic_cast<const plugins::Bibliography*>(&block);
    if (bibliography == nullptr)
    {
        throw std::invalid_argument{"The bibliography adapter received a different block type"};
    }

    auto widest_label = std::string{"9"};
    for (auto count = bibliography->entries().size(); count >= usize{10}; count /= usize{10})
    {
        widest_label.push_back('9');
    }
    output.write_raw("\\begin{thebibliography}{");
    output.write_raw(widest_label);
    output.write_raw("}\n");
    for (const auto& entry : bibliography->entries())
    {
        write_entry(output, *entry);
    }
    output.write_raw("\\end{thebibliography}\n\n");
}
}  // namespace dans::document::connectors::latex
