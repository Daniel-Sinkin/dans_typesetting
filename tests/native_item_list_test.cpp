// Verify semantic lists through the shared Core Paragraph inline connector.
#include "connectors/latex/core_paragraph.hpp"
#include "connectors/latex/item_list.hpp"
#include "connectors/latex/math.hpp"
#include "document.hpp"
#include "plugins/core_paragraph.hpp"
#include "plugins/item_list.hpp"
#include "plugins/math.hpp"
#include "writers/latex_writer.hpp"

#include <exception>
#include <memory>
#include <print>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>

namespace
{
using dans::document::Document;
using dans::document::connectors::latex::CoreParagraphInlineLatexRenderer;
using dans::document::connectors::latex::CoreTextLatexAdapter;
using dans::document::connectors::latex::InlineMathLatexAdapter;
using dans::document::connectors::latex::ItemListLatexAdapter;
using dans::document::plugins::ItemList;
using dans::document::plugins::ListPresentation;
using dans::document::plugins::Math;
using dans::document::plugins::TextStyle;
using dans::document::writers::LatexWriter;

auto expect(const bool condition, const std::string_view message) -> void
{
    if (!condition)
    {
        throw std::runtime_error{std::string{message}};
    }
}

auto render_list(const ListPresentation presentation) -> std::string
{
    Document document;
    auto& list = document.blocks().add<ItemList>(presentation);
    list.add_item("escaped & first");
    list.add_item("styled second", TextStyle::bold);
    auto& structured = list.add_item();
    structured.append_text("structured ");
    structured.inlines().add<Math::Inline>(Math::equal(Math::id_E, Math::id_4));

    auto inline_renderer = std::make_shared<CoreParagraphInlineLatexRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<CoreTextLatexAdapter>());
    inline_renderer->register_inline_adapter(std::make_unique<InlineMathLatexAdapter>());
    LatexWriter writer;
    writer.register_block_adapter(std::make_unique<ItemListLatexAdapter>(inline_renderer));
    std::ostringstream output;
    writer.serialize(document, output);
    return output.str();
}

auto run_test() -> void
{
    const auto itemized = render_list(ListPresentation::itemized);
    expect(itemized.contains("\\begin{itemize}"), "Itemized list environment was not emitted");
    expect(itemized.contains("\\item escaped \\& first"), "List item text was not escaped");
    expect(itemized.contains("\\item \\textbf{styled second}"), "List item style was lost");
    expect(
        itemized.contains(R"(\item structured \(E = 4\))"),
        "List items did not consume the registered inline-math extension"
    );
    expect(itemized.contains("\\end{itemize}"), "Itemized list was not closed");

    const auto enumerated = render_list(ListPresentation::enumerated);
    expect(
        enumerated.contains("\\begin{enumerate}"), "Enumerated list environment was not emitted"
    );
    expect(enumerated.contains("\\end{enumerate}"), "Enumerated list was not closed");

    auto inline_renderer = std::make_shared<CoreParagraphInlineLatexRenderer>();
    inline_renderer->register_inline_adapter(std::make_unique<CoreTextLatexAdapter>());
    LatexWriter writer;
    writer.register_block_adapter(std::make_unique<ItemListLatexAdapter>(inline_renderer));
    Document empty_document;
    empty_document.blocks().add<ItemList>();
    auto rejected = false;
    try
    {
        std::ostringstream output;
        writer.serialize(empty_document, output);
    }
    catch (const std::invalid_argument&)
    {
        rejected = true;
    }
    expect(rejected, "An empty semantic list was rendered");

    Document empty_item_document;
    empty_item_document.blocks().add<ItemList>().add_item();
    rejected = false;
    try
    {
        std::ostringstream output;
        writer.serialize(empty_item_document, output);
    }
    catch (const std::invalid_argument&)
    {
        rejected = true;
    }
    expect(rejected, "A semantic list item without inline content was rendered");
}
}  // namespace

auto main() noexcept -> int
{
    try
    {
        run_test();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_item_list_test failed: {}", error.what());
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
