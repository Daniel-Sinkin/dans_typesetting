// tests/native_jupyter_test.cpp — verify nbformat structure and Markdown preservation.
#include "connectors/markdown/code_listing.hpp"
#include "connectors/markdown/core_paragraph.hpp"
#include "connectors/markdown/document_shell.hpp"
#include "connectors/markdown/figure_pair.hpp"
#include "connectors/markdown/inline_code.hpp"
#include "connectors/markdown/math.hpp"
#include "document.hpp"
#include "plugins/code_listing.hpp"
#include "plugins/core_paragraph.hpp"
#include "plugins/document_shell.hpp"
#include "plugins/figure_pair.hpp"
#include "plugins/inline_code.hpp"
#include "plugins/math.hpp"
#include "transport/json.hpp"
#include "writers/jupyter_writer.hpp"
#include "writers/markdown_writer.hpp"

#include <exception>
#include <filesystem>
#include <fstream>
#include <memory>
#include <print>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>

namespace
{
namespace markdown = dans::document::connectors::markdown;
using dans::document::transport::JsonValue;

auto object_member(const JsonValue& object, const std::string_view key) -> const JsonValue&
{
    for (const auto& [name, value] : object.as_object())
    {
        if (name == key)
        {
            return value;
        }
    }
    throw std::runtime_error{"Missing JSON object member '" + std::string{key} + "'"};
}

auto join_source(const JsonValue& source) -> std::string
{
    std::string joined{};
    for (const auto& line : source.as_array())
    {
        joined += line.as_string();
    }
    return joined;
}

auto make_markdown_writer() -> std::shared_ptr<dans::document::writers::MarkdownWriter>
{
    auto inline_renderer = std::make_shared<markdown::CoreParagraphInlineMarkdownRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<markdown::CoreTextMarkdownAdapter>());
    inline_renderer->register_inline_adapter(
        std::make_unique<markdown::InlineCodeMarkdownAdapter>()
    );
    inline_renderer->register_inline_adapter(
        std::make_unique<markdown::InlineMathMarkdownAdapter>()
    );

    auto writer = std::make_shared<dans::document::writers::MarkdownWriter>();
    writer->register_block_adapter(
        std::make_unique<markdown::CoreParagraphMarkdownAdapter>(inline_renderer)
    );
    writer->register_block_adapter(std::make_unique<markdown::TitlePageMarkdownAdapter>());
    writer->register_block_adapter(
        std::make_unique<markdown::CodeListingMarkdownAdapter>(inline_renderer)
    );
    writer->register_block_adapter(
        std::make_unique<markdown::FigurePairMarkdownAdapter>(inline_renderer)
    );
    return writer;
}

auto make_document() -> dans::document::Document
{
    using namespace dans::document;
    using namespace dans::document::plugins;

    Document document{Metadata{.major = 3, .minor = 2, .patch = 1}};
    document.blocks().add<TitlePage>("Notebook export", "Daniel", "19 July 2026");
    auto& section = document.blocks().add<Section>("Mixed-language material");
    auto& paragraph = section.blocks().add<CoreParagraph>("Call ");
    paragraph.inlines().add<InlineCode>("cudaDeviceSynchronize()");
    paragraph.append_text(" and require ");
    paragraph.inlines().add<Math::Inline>(Math::less_equal(Math::id_partial, Math::id_infinity));
    paragraph.append_text(" over ");
    paragraph.inlines().add<Math::Inline>(Math::blackboard("R"));
    paragraph.append_text(" with ");
    paragraph.inlines().add<Math::Inline>(Math::underbrace(Math::id_2, Math::text("FMA & SIMD")));
    paragraph.append_text(" and offset ");
    paragraph.inlines().add<Math::Inline>(Math::negate(Math::decimal("0.125")));
    paragraph.append_text(" before reading timing data.");
    section.blocks().add<CodeListing>(
        CodeLanguage::cpp, "int main() { return 0; }\n", "C++ presentation source."
    );
    section.blocks().add<CodeListing>(
        CodeLanguage::julia, "energy(x) = sum(abs2, x)\n", "Julia presentation source."
    );
    section.blocks().add<FigurePair>(
        FigurePanel{ImageSource{"left.png"}, "Left panel", ReferenceId{"fig:notebook:left"}},
        FigurePanel{ImageSource{"right.png"}, "Right panel", ReferenceId{"fig:notebook:right"}},
        ReferenceId{"fig:notebook"},
        "Paired notebook figure."
    );
    return document;
}

auto verify_notebook() -> void
{
    const auto markdown_writer = make_markdown_writer();
    const auto document = make_document();

    std::ostringstream expected_markdown{};
    markdown_writer->serialize(document, expected_markdown);

    const dans::document::writers::JupyterWriter writer{markdown_writer};
    std::ostringstream serialized{};
    writer.serialize(document, serialized);
    const auto output_path = std::filesystem::path{DANS_TYPESETTING_JUPYTER_TEST_OUTPUT};
    writer.write_file(document, output_path);

    std::ifstream file{output_path, std::ios::binary};
    std::ostringstream file_content{};
    file_content << file.rdbuf();
    if (!file || file_content.str() != serialized.str())
    {
        throw std::runtime_error{"Jupyter file output differs from stream serialization"};
    }

    const auto notebook = JsonValue::parse(serialized.str());
    if (object_member(notebook, "nbformat").as_number().lexeme() != "4"
        || object_member(notebook, "nbformat_minor").as_number().lexeme() != "5")
    {
        throw std::runtime_error{"The Jupyter writer emitted an unexpected nbformat version"};
    }

    const auto& cells = object_member(notebook, "cells").as_array();
    if (cells.size() != dans::usize{1})
    {
        throw std::runtime_error{"The presentation notebook must contain exactly one cell"};
    }
    const auto& cell = cells.front();
    if (object_member(cell, "cell_type").as_string() != "markdown"
        || object_member(cell, "id").as_string() != "dans-document")
    {
        throw std::runtime_error{"The notebook document cell has invalid identity or type"};
    }
    if (join_source(object_member(cell, "source")) != expected_markdown.str())
    {
        throw std::runtime_error{"Notebook source did not preserve the Markdown export exactly"};
    }
    if (!expected_markdown.str().contains("```cpp") || !expected_markdown.str().contains("```julia")
        || !expected_markdown.str().contains(R"(${\partial} \leq {\infty}$)")
        || !expected_markdown.str().contains(R"($\mathbb{R}$)")
        || !expected_markdown.str().contains(R"($\underbrace{2}_{\text{FMA \& SIMD}}$)")
        || !expected_markdown.str().contains("$-0.125$")
        || !expected_markdown.str().contains("*Figure 1: Paired notebook figure\\.*")
        || serialized.str().contains("kernelspec"))
    {
        throw std::runtime_error{
            "The presentation notebook must preserve mixed listings without claiming a kernel"
        };
    }

    const auto& metadata = object_member(notebook, "metadata");
    const auto& typesetting = object_member(metadata, "dans_typesetting");
    const auto& version = object_member(typesetting, "document_model_version");
    if (object_member(version, "major").as_number().lexeme() != "3"
        || object_member(version, "minor").as_number().lexeme() != "2"
        || object_member(version, "patch").as_number().lexeme() != "1"
        || object_member(typesetting, "source_writer").as_string() != "dans-markdown-profile")
    {
        throw std::runtime_error{"Notebook typesetting metadata did not preserve model identity"};
    }

    const auto reparsed_file = JsonValue::parse(serialized.str()).to_pretty_string() + '\n';
    if (reparsed_file != serialized.str())
    {
        throw std::runtime_error{"Notebook JSON was not stable under parse/serialize"};
    }
}

auto verify_strict_failures() -> void
{
    auto rejected_null_writer = false;
    try
    {
        [[maybe_unused]] const dans::document::writers::JupyterWriter writer{nullptr};
    }
    catch (const std::invalid_argument&)
    {
        rejected_null_writer = true;
    }
    if (!rejected_null_writer)
    {
        throw std::runtime_error{"A null Markdown writer was accepted by the Jupyter writer"};
    }

    using namespace dans::document;
    using namespace dans::document::plugins;
    Document unsupported{};
    unsupported.blocks().add<TableOfContents>();
    const dans::document::writers::JupyterWriter writer{make_markdown_writer()};
    auto rejected_unsupported = false;
    try
    {
        std::ostringstream output{};
        writer.serialize(unsupported, output);
    }
    catch (const std::runtime_error&)
    {
        rejected_unsupported = true;
    }
    if (!rejected_unsupported)
    {
        throw std::runtime_error{"Jupyter export hid an unsupported Markdown block"};
    }
}
}  // namespace

auto main() noexcept -> int
{
    try
    {
        verify_notebook();
        verify_strict_failures();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_jupyter_test failed: {}", error.what());
        }
        catch (...)
        {
            return 1;
        }
        return 1;
    }
    catch (...)
    {
        return 1;
    }
}
