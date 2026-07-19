// tests/native_document_materializer_test.cpp — verify strict canonical-to-semantic decoding.
#include "connectors/latex/inline_sequence.hpp"
#include "connectors/latex/paragraph.hpp"
#include "connectors/transport/paragraph.hpp"
#include "plugins/paragraph.hpp"
#include "plugins/text.hpp"
#include "transport/document_materializer.hpp"
#include "transport/document_transport.hpp"
#include "writers/latex_writer.hpp"

#include <memory>
#include <print>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>

namespace
{
using dans::document::plugins::Paragraph;
using dans::document::plugins::Text;
using dans::document::plugins::TextStyle;
using dans::document::transport::DocumentMaterializer;

auto expect(const bool condition, const std::string_view message) -> void
{
    if (!condition)
    {
        throw std::runtime_error{std::string{message}};
    }
}

template <typename Function>
auto expect_rejected(Function&& function, const std::string_view context) -> void
{
    auto rejected = false;
    try
    {
        function();
    }
    catch (const std::exception&)
    {
        rejected = true;
    }
    if (!rejected)
    {
        throw std::runtime_error{std::string{context} + " was unexpectedly accepted"};
    }
}

[[nodiscard]] auto make_materializer() -> DocumentMaterializer
{
    DocumentMaterializer materializer;
    materializer.register_block_materializer(
        std::make_unique<dans::document::connectors::transport::ParagraphMaterializer>()
    );
    materializer.register_inline_materializer(
        std::make_unique<dans::document::connectors::transport::TextMaterializer>()
    );
    return materializer;
}

auto verify_paragraph_materialization() -> void
{
    constexpr auto source = R"({
  "format": "dans.typesetting.document",
  "schemaVersion": 1,
  "documentVersion": { "major": 1, "minor": 2, "patch": 3 },
  "blocks": [
    {
      "id": "paragraph-one",
      "type": "dans.core.paragraph",
      "payload": {
        "inlines": [
          {
            "id": "text-one",
            "type": "dans.core.text",
            "payload": { "text": "the quick brown fox jumped", "style": "normal" }
          },
          {
            "id": "text-two",
            "type": "dans.core.text",
            "payload": { "text": ".", "style": "italic" }
          }
        ]
      }
    }
  ]
})";

    const auto canonical = dans::document::transport::parse_canonical_document(source);
    const auto document = make_materializer().materialize(canonical);
    expect(document.metadata().major == 1U, "Materialization lost the document version");
    expect(document.blocks().blocks().size() == 1U, "Materialization lost a paragraph");

    const auto* paragraph = dynamic_cast<const Paragraph*>(document.blocks().blocks()[0].get());
    expect(paragraph != nullptr, "The canonical paragraph became a different block type");
    expect(paragraph->inlines().nodes().size() == 2U, "Paragraph inline order was lost");
    const auto* first_text = dynamic_cast<const Text*>(paragraph->inlines().nodes()[0].get());
    const auto* second_text = dynamic_cast<const Text*>(paragraph->inlines().nodes()[1].get());
    expect(first_text != nullptr && second_text != nullptr, "Text payloads were not materialized");
    expect(first_text->text() == "the quick brown fox jumped", "Text content changed");
    expect(first_text->style() == TextStyle::normal, "Normal text style changed");
    expect(second_text->style() == TextStyle::italic, "Italic text style changed");

    auto inline_renderer =
        std::make_shared<dans::document::connectors::latex::InlineLatexRenderer>();
    inline_renderer->register_inline_adapter(
        std::make_unique<dans::document::connectors::latex::TextLatexAdapter>()
    );
    dans::document::writers::LatexWriter writer;
    writer.register_block_adapter(
        std::make_unique<dans::document::connectors::latex::ParagraphLatexAdapter>(inline_renderer)
    );
    std::ostringstream latex;
    writer.serialize(document, latex);
    expect(
        latex.str().contains("the quick brown fox jumped\\textit{.}"),
        "A materialized document did not reach the LaTeX writer"
    );
}

auto verify_strict_failures() -> void
{
    auto materializer = make_materializer();
    expect_rejected(
        [&materializer]
        {
            materializer.register_block_materializer(
                std::make_unique<dans::document::connectors::transport::ParagraphMaterializer>()
            );
        },
        "Duplicate block materializer"
    );
    expect_rejected(
        [&materializer]
        {
            const auto canonical = dans::document::transport::parse_canonical_document(
                R"({"format":"dans.typesetting.document","schemaVersion":1,"documentVersion":{"major":0,"minor":1,"patch":0},"blocks":[{"id":"unknown","type":"third.party.block","payload":null}]})"
            );
            static_cast<void>(materializer.materialize(canonical));
        },
        "Unknown canonical block"
    );
    expect_rejected(
        [&materializer]
        {
            const auto canonical = dans::document::transport::parse_canonical_document(
                R"({"format":"dans.typesetting.document","schemaVersion":1,"documentVersion":{"major":0,"minor":1,"patch":0},"blocks":[{"id":"paragraph","type":"dans.core.paragraph","payload":{"inlines":[{"id":"unknown","type":"third.party.inline","payload":null}]}}]})"
            );
            static_cast<void>(materializer.materialize(canonical));
        },
        "Unknown canonical inline"
    );
    expect_rejected(
        [&materializer]
        {
            const auto canonical = dans::document::transport::parse_canonical_document(
                R"({"format":"dans.typesetting.document","schemaVersion":1,"documentVersion":{"major":0,"minor":1,"patch":0},"blocks":[{"id":"paragraph","type":"dans.core.paragraph","payload":{"inlines":[]}}]})"
            );
            static_cast<void>(materializer.materialize(canonical));
        },
        "Empty canonical paragraph"
    );
    expect_rejected(
        [&materializer]
        {
            const auto canonical = dans::document::transport::parse_canonical_document(
                R"({"format":"dans.typesetting.document","schemaVersion":1,"documentVersion":{"major":0,"minor":1,"patch":0},"blocks":[{"id":"paragraph","type":"dans.core.paragraph","payload":{"inlines":[{"id":"same","type":"dans.core.text","payload":{"text":"first","style":"normal"}},{"id":"same","type":"dans.core.text","payload":{"text":"second","style":"normal"}}]}}]})"
            );
            static_cast<void>(materializer.materialize(canonical));
        },
        "Duplicate canonical paragraph inline ID"
    );
}
}  // namespace

auto main() noexcept -> int
{
    try
    {
        verify_paragraph_materialization();
        verify_strict_failures();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_document_materializer_test failed: {}", error.what());
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
