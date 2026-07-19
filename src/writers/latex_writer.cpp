#include "writers/latex_writer.hpp"

#include <algorithm>
#include <array>
#include <fstream>
#include <ostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>

namespace
{
constexpr std::array<std::string_view, 5> k_section_commands{
    "section",
    "subsection",
    "subsubsection",
    "paragraph",
    "subparagraph",
};

auto write_text_command(
    dans::document::writers::LatexOutput& output,
    const std::string_view command,
    const std::string_view text
) -> void
{
    output.write_raw("\\");
    output.write_raw(command);
    output.write_raw("{");
    output.write_text(text);
    output.write_raw("}\n");
}
}  // namespace

namespace dans::document::writers
{
LatexOutput::LatexOutput(
    std::ostream& output, const LatexWriter& writer, const usize section_depth
) noexcept
    : output_{output}, writer_{writer}, section_depth_{section_depth}
{
}

auto LatexOutput::write_raw(const std::string_view text) -> void
{
    output_ << text;
}

auto LatexOutput::write_text(const std::string_view text) -> void
{
    for (const char character : text)
    {
        switch (character)
        {
            case '\\':
                write_raw("\\textbackslash{}");
                break;
            case '{':
                write_raw("\\{");
                break;
            case '}':
                write_raw("\\}");
                break;
            case '$':
                write_raw("\\$");
                break;
            case '&':
                write_raw("\\&");
                break;
            case '#':
                write_raw("\\#");
                break;
            case '%':
                write_raw("\\%");
                break;
            case '_':
                write_raw("\\_");
                break;
            case '~':
                write_raw("\\textasciitilde{}");
                break;
            case '^':
                write_raw("\\textasciicircum{}");
                break;
            case '\r':
                break;
            default:
                output_.put(character);
                break;
        }
    }
}

auto LatexOutput::write_blocks(const BlockSequence& blocks) -> void
{
    writer_.emit_blocks(blocks, *this);
}

auto LatexWriter::register_block_adapter(std::unique_ptr<LatexBlockAdapter> adapter) -> void
{
    if (adapter == nullptr)
    {
        throw std::invalid_argument{"Cannot register a null LaTeX block adapter"};
    }
    if (adapter->block_type_id().empty())
    {
        throw std::invalid_argument{"A LaTeX block adapter must have a block type ID"};
    }
    if (supports_block(adapter->block_type_id()))
    {
        throw std::invalid_argument{
            "A LaTeX adapter is already registered for block type '"
            + std::string{adapter->block_type_id()} + "'"
        };
    }

    block_adapters_.push_back(std::move(adapter));
}

auto LatexWriter::supports_block(const std::string_view block_type_id) const noexcept -> bool
{
    return block_adapter_for(block_type_id) != nullptr;
}

auto LatexWriter::serialize(const Document& document, std::ostream& output) const -> void
{
    output << render(document);
    if (!output)
    {
        throw std::runtime_error{"Could not serialize the document as LaTeX"};
    }
}

auto LatexWriter::write_file(
    const Document& document, const std::filesystem::path& output_path
) const -> void
{
    const auto rendered_document = render(document);

    std::ofstream output{output_path, std::ios::binary | std::ios::trunc};
    if (!output)
    {
        throw std::runtime_error{"Could not open LaTeX output: " + output_path.string()};
    }

    output << rendered_document;
    output.flush();
    if (!output)
    {
        throw std::runtime_error{"Could not write LaTeX output: " + output_path.string()};
    }
}

auto LatexWriter::block_adapter_for(const std::string_view block_type_id) const noexcept
    -> const LatexBlockAdapter*
{
    const auto match = std::ranges::find_if(
        block_adapters_,
        [block_type_id](const std::unique_ptr<LatexBlockAdapter>& adapter)
        { return adapter->block_type_id() == block_type_id; }
    );
    return match == block_adapters_.end() ? nullptr : match->get();
}

auto LatexWriter::render(const Document& document) const -> std::string
{
    validate(document);

    std::ostringstream buffer;
    LatexOutput output{buffer, *this, 0};
    emit_document(document, output);
    if (!buffer)
    {
        throw std::runtime_error{"Could not render the document as LaTeX"};
    }
    return buffer.str();
}

auto LatexWriter::validate(const Document& document) const -> void
{
    validate_blocks(document.blocks(), 0);
}

auto LatexWriter::validate_blocks(const BlockSequence& blocks, const usize section_depth) const
    -> void
{
    for (const auto& block : blocks.blocks())
    {
        if (const auto* section = dynamic_cast<const Section*>(block.get()); section != nullptr)
        {
            if (section_depth >= k_section_commands.size())
            {
                throw std::length_error{
                    "The LaTeX writer supports at most five nested section levels"
                };
            }
            validate_blocks(section->blocks(), section_depth + usize{1});
            continue;
        }

        if (!supports_block(block->type_id()))
        {
            throw std::runtime_error{
                "No LaTeX adapter is registered for block type '" + std::string{block->type_id()}
                + "'"
            };
        }
    }
}

auto LatexWriter::emit_document(const Document& document, LatexOutput& output) const -> void
{
    output.write_raw("% Document model version ");
    output.write_raw(std::to_string(document.metadata().major));
    output.write_raw(".");
    output.write_raw(std::to_string(document.metadata().minor));
    output.write_raw(".");
    output.write_raw(std::to_string(document.metadata().patch));
    output.write_raw("\n");
    output.write_raw("\\documentclass[11pt,a4paper]{article}\n");
    output.write_raw("\\usepackage{fontspec}\n");
    output.write_raw("\\usepackage{amsmath}\n");
    output.write_raw("\\usepackage{graphicx}\n");
    output.write_raw("\\usepackage{microtype}\n");
    output.write_raw("\\usepackage{xcolor}\n");
    output.write_raw("\\usepackage{booktabs}\n");
    output.write_raw("\\usepackage{listings}\n");
    output.write_raw(
        "\\lstdefinelanguage{Julia}{%\n"
        "  morekeywords={baremodule,begin,break,catch,const,continue,do,else,elseif,end,export,"
        "finally,for,function,global,if,import,let,local,macro,module,quote,return,struct,"
        "try,using,while},%\n"
        "  sensitive=true,%\n"
        "  morecomment=[l]{\\#},%\n"
        "  morestring=[b]{\\\"}%\n"
        "}\n"
    );
    output.write_raw(
        "\\lstdefinelanguage{CUDA}[]{C++}{%\n"
        "  morekeywords={__global__,__device__,__host__,__shared__,__constant__,__managed__,"
        "__launch_bounds__,threadIdx,blockIdx,blockDim,gridDim,warpSize}%\n"
        "}\n"
    );
    output.write_raw(
        "\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,columns=fullflexible,"
        "keepspaces=true,showstringspaces=false}\n"
    );
    output.write_raw("\\usepackage[hidelinks]{hyperref}\n\n");

    output.write_raw("\\begin{document}\n");
    emit_blocks(document.blocks(), output);
    output.write_raw("\\end{document}\n");
}

auto LatexWriter::emit_blocks(const BlockSequence& blocks, LatexOutput& output) const -> void
{
    for (const auto& block : blocks.blocks())
    {
        if (const auto* section = dynamic_cast<const Section*>(block.get()); section != nullptr)
        {
            write_text_command(
                output, k_section_commands.at(output.section_depth_), section->title()
            );
            if (section->reference_id().has_value())
            {
                output.write_raw("\\label{");
                output.write_raw(section->reference_id()->value());
                output.write_raw("}\n");
            }
            LatexOutput section_output{output.output_, *this, output.section_depth_ + usize{1}};
            emit_blocks(section->blocks(), section_output);
            continue;
        }

        const auto* adapter = block_adapter_for(block->type_id());
        if (adapter == nullptr)
        {
            throw std::logic_error{"LaTeX adapter disappeared after document validation"};
        }
        adapter->serialize(*block, output);
    }
}

}  // namespace dans::document::writers
