// src/writers/jupyter_writer.cpp — wrap authoritative Markdown in nbformat 4 JSON.
#include "writers/jupyter_writer.hpp"

#include "transport/json.hpp"

#include <fstream>
#include <ostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>

namespace dans::document::writers
{
namespace
{
using transport::JsonNumber;
using transport::JsonValue;

auto notebook_source_lines(const std::string_view source) -> JsonValue::Array
{
    JsonValue::Array lines{};
    usize position{};
    while (position < source.size())
    {
        const auto newline = source.find('\n', position);
        if (newline == std::string_view::npos)
        {
            lines.emplace_back(std::string{source.substr(position)});
            break;
        }
        const auto length = newline - position + usize{1};
        lines.emplace_back(std::string{source.substr(position, length)});
        position = newline + usize{1};
    }
    if (lines.empty())
    {
        lines.emplace_back(std::string{});
    }
    return lines;
}

auto model_version(const Metadata& metadata) -> JsonValue
{
    return JsonValue{JsonValue::Object{
        {"major", JsonValue{JsonNumber{std::to_string(metadata.major)}}},
        {"minor", JsonValue{JsonNumber{std::to_string(metadata.minor)}}},
        {"patch", JsonValue{JsonNumber{std::to_string(metadata.patch)}}},
    }};
}

auto make_notebook(const Document& document, const std::string_view markdown) -> JsonValue
{
    JsonValue::Object cell{
        {"cell_type", JsonValue{std::string{"markdown"}}},
        {"id", JsonValue{std::string{"dans-document"}}},
        {"metadata", JsonValue{JsonValue::Object{}}},
        {"source", JsonValue{notebook_source_lines(markdown)}},
    };
    JsonValue::Object typesetting_metadata{
        {"document_model_version", model_version(document.metadata())},
        {"source_writer", JsonValue{std::string{"dans-markdown-profile"}}},
    };
    JsonValue::Object notebook_metadata{
        {"dans_typesetting", JsonValue{std::move(typesetting_metadata)}},
    };
    return JsonValue{JsonValue::Object{
        {"cells", JsonValue{JsonValue::Array{JsonValue{std::move(cell)}}}},
        {"metadata", JsonValue{std::move(notebook_metadata)}},
        {"nbformat", JsonValue{JsonNumber{"4"}}},
        {"nbformat_minor", JsonValue{JsonNumber{"5"}}},
    }};
}
}  // namespace

JupyterWriter::JupyterWriter(std::shared_ptr<const MarkdownWriter> markdown_writer)
    : markdown_writer_{std::move(markdown_writer)}
{
    if (markdown_writer_ == nullptr)
    {
        throw std::invalid_argument{"A Jupyter writer requires a configured Markdown writer"};
    }
}

auto JupyterWriter::serialize(const Document& document, std::ostream& output) const -> void
{
    output << render(document);
    if (!output)
    {
        throw std::runtime_error{"Could not serialize the document as a Jupyter notebook"};
    }
}

auto JupyterWriter::write_file(
    const Document& document, const std::filesystem::path& output_path
) const -> void
{
    const auto rendered_notebook = render(document);
    std::ofstream output{output_path, std::ios::binary | std::ios::trunc};
    if (!output)
    {
        throw std::runtime_error{"Could not open Jupyter output: " + output_path.string()};
    }
    output << rendered_notebook;
    output.flush();
    if (!output)
    {
        throw std::runtime_error{"Could not write Jupyter output: " + output_path.string()};
    }
}

auto JupyterWriter::render(const Document& document) const -> std::string
{
    std::ostringstream markdown{};
    markdown_writer_->serialize(document, markdown);
    auto result = make_notebook(document, markdown.str()).to_pretty_string();
    result += '\n';
    return result;
}
}  // namespace dans::document::writers
