// src/writers/markdown_writer.cpp — walk semantic documents and delegate Markdown lowering.
#include "writers/markdown_writer.hpp"

#include <algorithm>
#include <array>
#include <fstream>
#include <map>
#include <ostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>

namespace dans::document::writers
{
namespace
{
constexpr usize k_maximum_section_depth{6};

struct MarkdownSectionEntry
{
    const Section* section{};
    usize depth{};
    std::string number{};
    std::string anchor{};
};

struct MarkdownTargetEntry
{
    const DocumentBlock* block{};
    usize occurrence_index{};
    std::string reference_id{};
    std::string label{};
    std::string number{};
    std::string anchor{};
};

struct MarkdownResourceEntry
{
    std::string namespace_id{};
    std::string key{};
    std::string number{};
    std::string anchor{};
};

auto join_section_number(const std::vector<usize>& path) -> std::string
{
    std::string result{};
    for (const auto part : path)
    {
        if (!result.empty())
        {
            result += '.';
        }
        result += std::to_string(part);
    }
    return result;
}

auto encode_destination_byte(const unsigned char byte) -> std::string
{
    constexpr std::array<char, 16> k_hex_digits{
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'
    };
    std::string result{"%00"};
    result[1] = k_hex_digits[static_cast<usize>(byte >> 4u)];
    result[2] = k_hex_digits[static_cast<usize>(byte & 0x0fu)];
    return result;
}
}  // namespace

class MarkdownRenderContext final
{
  public:
    std::vector<MarkdownSectionEntry> sections{};
    std::vector<MarkdownTargetEntry> targets{};
    std::vector<MarkdownResourceEntry> resources{};
    std::vector<std::string> footnotes{};
};

auto escape_markdown_text(const std::string_view text) -> std::string
{
    std::string escaped{};
    escaped.reserve(text.size());
    for (const char character : text)
    {
        switch (character)
        {
            case '\r':
                break;
            case '\n':
                escaped += "  \n";
                break;
            case '\\':
            case '`':
            case '*':
            case '_':
            case '{':
            case '}':
            case '[':
            case ']':
            case '<':
            case '>':
            case '#':
            case '$':
            case '&':
            case '+':
            case '-':
            case '.':
            case '=':
            case '!':
            case '|':
            case '~':
                escaped += '\\';
                escaped += character;
                break;
            default:
                escaped += character;
                break;
        }
    }
    return escaped;
}

auto markdown_link_destination(const std::string_view destination) -> std::string
{
    if (destination.empty())
    {
        throw std::invalid_argument{"A Markdown link destination must not be empty"};
    }

    std::string encoded{"<"};
    for (const char character : destination)
    {
        const auto byte = static_cast<unsigned char>(character);
        if (character == '<' || character == '>' || character == '\n' || character == '\r')
        {
            encoded += encode_destination_byte(byte);
        }
        else
        {
            encoded += character;
        }
    }
    encoded += '>';
    return encoded;
}

MarkdownOutput::MarkdownOutput(
    std::ostream& output,
    const MarkdownWriter& writer,
    MarkdownRenderContext& context,
    const usize section_depth
) noexcept
    : output_{output}, writer_{writer}, context_{context}, section_depth_{section_depth}
{
}

auto MarkdownOutput::write_raw(const std::string_view text) -> void
{
    output_ << text;
}

auto MarkdownOutput::write_text(const std::string_view text) -> void
{
    write_raw(escape_markdown_text(text));
}

auto MarkdownOutput::write_blocks(const BlockSequence& blocks) -> void
{
    writer_.emit_blocks(blocks, *this);
}

auto MarkdownOutput::write_table_of_contents() -> void
{
    writer_.emit_table_of_contents(*this);
}

auto MarkdownOutput::write_anchor(const ReferenceId& reference_id) -> void
{
    write_raw("<a id=\"");
    write_raw(reference_id.value());
    write_raw("\"></a>\n");
}

auto MarkdownOutput::register_footnote(std::string content) -> std::string
{
    if (content.empty())
    {
        throw std::invalid_argument{"A Markdown footnote requires rendered content"};
    }
    context_.footnotes.push_back(std::move(content));
    return std::to_string(context_.footnotes.size());
}

auto MarkdownOutput::target_number(const DocumentBlock& block) const -> std::string_view
{
    return target_number(block, usize{0});
}

auto MarkdownOutput::target_number(const DocumentBlock& block, const usize occurrence_index) const
    -> std::string_view
{
    const auto match = std::ranges::find_if(
        context_.targets,
        [&block, occurrence_index](const MarkdownTargetEntry& target)
        { return target.block == &block && target.occurrence_index == occurrence_index; }
    );
    if (match == context_.targets.end())
    {
        throw std::logic_error{"The Markdown block did not publish a numbering target"};
    }
    return match->number;
}

auto MarkdownOutput::target_number(const ReferenceId& reference_id) const -> std::string_view
{
    const auto match = std::ranges::find_if(
        context_.targets,
        [&reference_id](const MarkdownTargetEntry& target)
        { return target.reference_id == reference_id.value(); }
    );
    if (match == context_.targets.end())
    {
        throw std::logic_error{
            "No Markdown target exists for reference ID '" + std::string{reference_id.value()} + "'"
        };
    }
    return match->number;
}

auto MarkdownOutput::reference_link(const ReferenceId& reference_id) const -> std::string
{
    const auto section = std::ranges::find_if(
        context_.sections,
        [&reference_id](const MarkdownSectionEntry& entry)
        {
            return entry.section->reference_id().has_value()
                   && entry.section->reference_id()->value() == reference_id.value();
        }
    );
    if (section != context_.sections.end())
    {
        return "[Section " + section->number + "](#" + section->anchor + ")";
    }

    const auto target = std::ranges::find_if(
        context_.targets,
        [&reference_id](const MarkdownTargetEntry& entry)
        { return entry.reference_id == reference_id.value(); }
    );
    if (target == context_.targets.end())
    {
        throw std::invalid_argument{
            "Markdown reference target '" + std::string{reference_id.value()} + "' does not exist"
        };
    }
    return "[" + target->label + " " + target->number + "](#" + target->anchor + ")";
}

auto MarkdownOutput::resource_number(
    const std::string_view namespace_id, const std::string_view key
) const -> std::string_view
{
    const auto resource = std::ranges::find_if(
        context_.resources,
        [namespace_id, key](const MarkdownResourceEntry& entry)
        { return entry.namespace_id == namespace_id && entry.key == key; }
    );
    if (resource == context_.resources.end())
    {
        throw std::invalid_argument{
            "Markdown resource '" + std::string{namespace_id} + "/" + std::string{key}
            + "' does not exist"
        };
    }
    return resource->number;
}

auto MarkdownOutput::resource_anchor(
    const std::string_view namespace_id, const std::string_view key
) const -> std::string_view
{
    const auto resource = std::ranges::find_if(
        context_.resources,
        [namespace_id, key](const MarkdownResourceEntry& entry)
        { return entry.namespace_id == namespace_id && entry.key == key; }
    );
    if (resource == context_.resources.end())
    {
        throw std::invalid_argument{
            "Markdown resource '" + std::string{namespace_id} + "/" + std::string{key}
            + "' does not exist"
        };
    }
    return resource->anchor;
}

auto MarkdownBlockAdapter::targets(const DocumentBlock&) const
    -> std::vector<MarkdownTargetDescriptor>
{
    return {};
}

auto MarkdownBlockAdapter::resources(const DocumentBlock&) const
    -> std::vector<MarkdownResourceDescriptor>
{
    return {};
}

auto MarkdownWriter::register_block_adapter(std::unique_ptr<MarkdownBlockAdapter> adapter) -> void
{
    if (adapter == nullptr)
    {
        throw std::invalid_argument{"Cannot register a null Markdown block adapter"};
    }
    if (adapter->block_type_id().empty())
    {
        throw std::invalid_argument{"A Markdown block adapter must have a block type ID"};
    }
    if (supports_block(adapter->block_type_id()))
    {
        throw std::invalid_argument{
            "A Markdown adapter is already registered for block type '"
            + std::string{adapter->block_type_id()} + "'"
        };
    }
    block_adapters_.push_back(std::move(adapter));
}

auto MarkdownWriter::supports_block(const std::string_view block_type_id) const noexcept -> bool
{
    return block_adapter_for(block_type_id) != nullptr;
}

auto MarkdownWriter::serialize(const Document& document, std::ostream& output) const -> void
{
    output << render(document);
    if (!output)
    {
        throw std::runtime_error{"Could not serialize the document as Markdown"};
    }
}

auto MarkdownWriter::write_file(
    const Document& document, const std::filesystem::path& output_path
) const -> void
{
    const auto rendered_document = render(document);
    std::ofstream output{output_path, std::ios::binary | std::ios::trunc};
    if (!output)
    {
        throw std::runtime_error{"Could not open Markdown output: " + output_path.string()};
    }
    output << rendered_document;
    output.flush();
    if (!output)
    {
        throw std::runtime_error{"Could not write Markdown output: " + output_path.string()};
    }
}

auto MarkdownWriter::block_adapter_for(const std::string_view block_type_id) const noexcept
    -> const MarkdownBlockAdapter*
{
    const auto match = std::ranges::find_if(
        block_adapters_,
        [block_type_id](const std::unique_ptr<MarkdownBlockAdapter>& adapter)
        { return adapter->block_type_id() == block_type_id; }
    );
    return match == block_adapters_.end() ? nullptr : match->get();
}

auto MarkdownWriter::render(const Document& document) const -> std::string
{
    auto context = prepare_context(document);
    std::ostringstream buffer{};
    MarkdownOutput output{buffer, *this, context, 0};
    emit_document(document, output);
    if (!buffer)
    {
        throw std::runtime_error{"Could not render the document as Markdown"};
    }
    return buffer.str();
}

auto MarkdownWriter::prepare_context(const Document& document) const -> MarkdownRenderContext
{
    MarkdownRenderContext context{};
    std::map<std::string, usize, std::less<>> series_counts{};
    std::map<std::string, usize, std::less<>> resource_counts{};
    std::vector<std::string> reference_ids{};
    usize generated_section_anchor{};

    const auto add_reference_id = [&reference_ids](const std::string_view reference_id)
    {
        if (std::ranges::find(reference_ids, reference_id) != reference_ids.end())
        {
            throw std::invalid_argument{
                "Duplicate Markdown reference target '" + std::string{reference_id} + "'"
            };
        }
        reference_ids.emplace_back(reference_id);
    };

    const auto visit_blocks = [&]<typename Self>(
                                  Self&& self,
                                  const BlockSequence& blocks,
                                  const usize depth,
                                  const std::vector<usize>& parent_path
                              ) -> void
    {
        usize section_ordinal{};
        for (const auto& block : blocks.blocks())
        {
            if (const auto* section = dynamic_cast<const Section*>(block.get()); section != nullptr)
            {
                if (depth >= k_maximum_section_depth)
                {
                    throw std::length_error{
                        "The Markdown writer supports at most six nested section levels"
                    };
                }
                ++section_ordinal;
                auto path = parent_path;
                path.push_back(section_ordinal);
                std::string anchor{};
                if (section->reference_id().has_value())
                {
                    anchor = section->reference_id()->value();
                    add_reference_id(anchor);
                }
                else
                {
                    do
                    {
                        ++generated_section_anchor;
                        anchor = "dans-section-" + std::to_string(generated_section_anchor);
                    } while (std::ranges::find(reference_ids, anchor) != reference_ids.end());
                    add_reference_id(anchor);
                }
                context.sections.push_back(
                    MarkdownSectionEntry{
                        .section = section,
                        .depth = depth,
                        .number = join_section_number(path),
                        .anchor = std::move(anchor),
                    }
                );
                self(self, section->blocks(), depth + usize{1}, path);
                continue;
            }

            const auto* adapter = block_adapter_for(block->type_id());
            if (adapter == nullptr)
            {
                throw std::runtime_error{
                    "No Markdown adapter is registered for block type '"
                    + std::string{block->type_id()} + "'"
                };
            }
            usize occurrence_index{};
            for (const auto& descriptor : adapter->targets(*block))
            {
                if (descriptor.label.empty() || descriptor.numbering_series.empty())
                {
                    throw std::logic_error{
                        "A Markdown target descriptor requires a label and numbering series"
                    };
                }
                auto& series_count = series_counts[std::string{descriptor.numbering_series}];
                if (descriptor.advances_numbering)
                {
                    ++series_count;
                }
                else if (series_count == usize{0})
                {
                    throw std::logic_error{
                        "A subordinate Markdown target requires an earlier target in its "
                        "numbering series"
                    };
                }
                std::string reference_id{};
                if (descriptor.reference_id != nullptr)
                {
                    reference_id = descriptor.reference_id->value();
                    add_reference_id(reference_id);
                }
                context.targets.push_back(
                    MarkdownTargetEntry{
                        .block = block.get(),
                        .occurrence_index = occurrence_index,
                        .reference_id = reference_id,
                        .label = std::string{descriptor.label},
                        .number =
                            std::to_string(series_count) + std::string{descriptor.number_suffix},
                        .anchor = reference_id,
                    }
                );
                ++occurrence_index;
            }
            for (const auto& descriptor : adapter->resources(*block))
            {
                if (descriptor.namespace_id.empty() || descriptor.key.empty())
                {
                    throw std::logic_error{
                        "A Markdown resource descriptor requires a namespace and key"
                    };
                }
                const auto duplicate = std::ranges::find_if(
                    context.resources,
                    [&descriptor](const MarkdownResourceEntry& resource)
                    {
                        return resource.namespace_id == descriptor.namespace_id
                               && resource.key == descriptor.key;
                    }
                );
                if (duplicate != context.resources.end())
                {
                    throw std::invalid_argument{
                        "Duplicate Markdown resource '" + std::string{descriptor.namespace_id} + "/"
                        + std::string{descriptor.key} + "'"
                    };
                }
                auto& resource_count = resource_counts[std::string{descriptor.namespace_id}];
                ++resource_count;
                context.resources.push_back(
                    MarkdownResourceEntry{
                        .namespace_id = std::string{descriptor.namespace_id},
                        .key = std::string{descriptor.key},
                        .number = std::to_string(resource_count),
                        .anchor =
                            "dans-resource-" + std::to_string(context.resources.size() + usize{1}),
                    }
                );
            }
            for (usize index{}; index < block->child_sequence_count(); ++index)
            {
                if (block->child_sequence_id(index).empty())
                {
                    throw std::logic_error{"A nested block exposed an unnamed child sequence"};
                }
                self(self, block->child_sequence(index), depth, parent_path);
            }
        }
    };

    visit_blocks(visit_blocks, document.blocks(), 0, {});
    return context;
}

auto MarkdownWriter::emit_document(const Document& document, MarkdownOutput& output) const -> void
{
    output.write_raw("<!-- Document model version ");
    output.write_raw(std::to_string(document.metadata().major));
    output.write_raw(".");
    output.write_raw(std::to_string(document.metadata().minor));
    output.write_raw(".");
    output.write_raw(std::to_string(document.metadata().patch));
    output.write_raw(" -->\n\n");
    emit_blocks(document.blocks(), output);
    emit_footnotes(output);
}

auto MarkdownWriter::emit_blocks(const BlockSequence& blocks, MarkdownOutput& output) const -> void
{
    for (const auto& block : blocks.blocks())
    {
        if (const auto* section = dynamic_cast<const Section*>(block.get()); section != nullptr)
        {
            const auto entry = std::ranges::find_if(
                output.context_.sections,
                [section](const MarkdownSectionEntry& candidate)
                { return candidate.section == section; }
            );
            if (entry == output.context_.sections.end())
            {
                throw std::logic_error{"A Markdown section disappeared after validation"};
            }
            output.write_raw("<a id=\"");
            output.write_raw(entry->anchor);
            output.write_raw("\"></a>\n");
            output.write_raw(std::string(entry->depth + usize{1}, '#'));
            output.write_raw(" ");
            output.write_text(section->title());
            output.write_raw("\n\n");
            MarkdownOutput section_output{
                output.output_, *this, output.context_, output.section_depth_ + usize{1}
            };
            emit_blocks(section->blocks(), section_output);
            continue;
        }

        const auto* adapter = block_adapter_for(block->type_id());
        if (adapter == nullptr)
        {
            throw std::logic_error{"Markdown adapter disappeared after document validation"};
        }
        adapter->serialize(*block, output);
    }
}

auto MarkdownWriter::emit_table_of_contents(MarkdownOutput& output) const -> void
{
    output.write_raw("## Contents\n\n");
    if (output.context_.sections.empty())
    {
        output.write_raw("_This document has no sections._\n\n");
        return;
    }
    for (const auto& section : output.context_.sections)
    {
        output.write_raw(std::string(section.depth * usize{2}, ' '));
        output.write_raw("- [");
        output.write_text(section.section->title());
        output.write_raw("](#");
        output.write_raw(section.anchor);
        output.write_raw(")\n");
    }
    output.write_raw("\n");
}

auto MarkdownWriter::emit_footnotes(MarkdownOutput& output) const -> void
{
    for (usize index{}; index < output.context_.footnotes.size(); ++index)
    {
        auto content = output.context_.footnotes[index];
        usize position{};
        while ((position = content.find('\n', position)) != std::string::npos)
        {
            content.replace(position, 1, "\n    ");
            position += usize{5};
        }
        output.write_raw("[^");
        output.write_raw(std::to_string(index + usize{1}));
        output.write_raw("]: ");
        output.write_raw(content);
        output.write_raw("\n");
    }
    if (!output.context_.footnotes.empty())
    {
        output.write_raw("\n");
    }
}
}  // namespace dans::document::writers
