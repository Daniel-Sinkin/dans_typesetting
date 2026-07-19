// src/connectors/markdown/bibliography.cpp — render numeric citations and normalized records.
#include "connectors/markdown/bibliography.hpp"

#include <stdexcept>
#include <string>

namespace dans::document::connectors::markdown
{
namespace
{
auto write_sentence(writers::MarkdownOutput& output, const std::string_view value) -> void
{
    if (!value.empty())
    {
        output.write_text(value);
        output.write_raw(". ");
    }
}

auto write_entry(writers::MarkdownOutput& output, const plugins::BibliographyEntry& entry) -> void
{
    const auto number =
        output.resource_number(k_bibliography_resource_namespace, entry.key().value());
    const auto anchor =
        output.resource_anchor(k_bibliography_resource_namespace, entry.key().value());
    output.write_raw(number);
    output.write_raw(". <a id=\"");
    output.write_raw(anchor);
    output.write_raw("\"></a>");
    for (usize index{}; index < entry.authors().size(); ++index)
    {
        if (index != usize{0})
        {
            output.write_raw(index + usize{1} == entry.authors().size() ? " and " : "; ");
        }
        output.write_text(entry.authors()[index]);
    }
    if (!entry.authors().empty())
    {
        output.write_raw(". ");
    }
    output.write_raw("*");
    output.write_text(entry.title());
    output.write_raw("*. ");
    write_sentence(output, entry.venue());
    write_sentence(output, entry.publisher());
    if (entry.year().has_value())
    {
        output.write_raw(std::to_string(*entry.year()));
        output.write_raw(". ");
    }
    if (!entry.doi().empty())
    {
        output.write_raw("[doi:");
        output.write_text(entry.doi());
        output.write_raw("](");
        output.write_raw(
            writers::markdown_link_destination("https://doi.org/" + std::string{entry.doi()})
        );
        output.write_raw("). ");
    }
    if (!entry.url().empty())
    {
        output.write_raw("[");
        output.write_text(entry.url());
        output.write_raw("](");
        output.write_raw(writers::markdown_link_destination(entry.url()));
        output.write_raw("). ");
    }
    output.write_raw("\n");
}
}  // namespace

auto CitationMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Citation::k_type_id;
}

auto CitationMarkdownAdapter::serialize(
    const plugins::InlineNode& node, InlineMarkdownOutput& output
) const -> void
{
    const auto* citation = dynamic_cast<const plugins::Citation*>(&node);
    if (citation == nullptr)
    {
        throw std::invalid_argument{"The citation adapter received a different inline type"};
    }
    output.write_raw("[");
    for (usize index{}; index < citation->keys().size(); ++index)
    {
        if (index != usize{0})
        {
            output.write_raw(", ");
        }
        const auto key = citation->keys()[index].value();
        output.write_raw("[");
        output.write_raw(output.context().resource_number(k_bibliography_resource_namespace, key));
        output.write_raw("](#");
        output.write_raw(output.context().resource_anchor(k_bibliography_resource_namespace, key));
        output.write_raw(")");
    }
    output.write_raw("]");
}

auto BibliographyMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Bibliography::k_type_id;
}

auto BibliographyMarkdownAdapter::resources(const DocumentBlock& block) const
    -> std::vector<writers::MarkdownResourceDescriptor>
{
    const auto* bibliography = dynamic_cast<const plugins::Bibliography*>(&block);
    if (bibliography == nullptr)
    {
        throw std::invalid_argument{"The bibliography adapter received a different block type"};
    }
    std::vector<writers::MarkdownResourceDescriptor> resources{};
    resources.reserve(bibliography->entries().size());
    for (const auto& entry : bibliography->entries())
    {
        resources.push_back(
            writers::MarkdownResourceDescriptor{
                .namespace_id = k_bibliography_resource_namespace,
                .key = entry->key().value(),
            }
        );
    }
    return resources;
}

auto BibliographyMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* bibliography = dynamic_cast<const plugins::Bibliography*>(&block);
    if (bibliography == nullptr)
    {
        throw std::invalid_argument{"The bibliography adapter received a different block type"};
    }
    if (bibliography->entries().empty())
    {
        throw std::invalid_argument{"A rendered bibliography requires at least one entry"};
    }
    output.write_raw("## References\n\n");
    for (const auto& entry : bibliography->entries())
    {
        write_entry(output, *entry);
    }
    output.write_raw("\n");
}
}  // namespace dans::document::connectors::markdown
