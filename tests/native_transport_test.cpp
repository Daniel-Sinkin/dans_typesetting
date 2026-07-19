// tests/native_transport_test.cpp — shared canonical transport contract tests.
#include "transport/document_transport.hpp"
#include "transport/json.hpp"

#include <filesystem>
#include <fstream>
#include <iterator>
#include <print>
#include <stdexcept>
#include <string>
#include <string_view>

#ifndef DANS_TYPESETTING_CANONICAL_FIXTURE
#    error "DANS_TYPESETTING_CANONICAL_FIXTURE must identify the shared transport fixture"
#endif

#ifndef DANS_TYPESETTING_TRANSPORT_TEST_OUTPUT
#    error "DANS_TYPESETTING_TRANSPORT_TEST_OUTPUT must identify a build-tree test output"
#endif

namespace
{
using dans::document::transport::JsonValue;

[[nodiscard]] auto read_text(const std::filesystem::path& path) -> std::string
{
    std::ifstream input{path, std::ios::binary};
    if (!input)
    {
        throw std::runtime_error{"Could not open test fixture: " + path.string()};
    }
    return {std::istreambuf_iterator<char>{input}, std::istreambuf_iterator<char>{}};
}

auto expect(const bool condition, const std::string_view message) -> void
{
    if (!condition)
    {
        throw std::runtime_error{std::string{message}};
    }
}

template <typename Function>
auto expect_invalid(Function&& function, const std::string_view context) -> void
{
    auto rejected = false;
    try
    {
        function();
    }
    catch (const std::invalid_argument&)
    {
        rejected = true;
    }
    if (!rejected)
    {
        throw std::runtime_error{std::string{context} + " was unexpectedly accepted"};
    }
}

auto verify_json_parser() -> void
{
    const auto source = std::string{R"({"text":"line\n\u03a9 \ud83d\ude80","value":-3.2e+4})"};
    const auto parsed = JsonValue::parse(source);
    expect(parsed.is_object(), "JSON object kind was not preserved");
    expect(
        parsed.to_pretty_string().contains("line\\nΩ 🚀"),
        "JSON escapes were not decoded and re-encoded correctly"
    );
    expect_invalid(
        [] { static_cast<void>(JsonValue::parse(R"({"same":1,"same":2})")); }, "Duplicate JSON key"
    );
    expect_invalid([] { static_cast<void>(JsonValue::parse("01")); }, "JSON leading zero");
    expect_invalid(
        [] { static_cast<void>(JsonValue::parse(R"("\ud800")")); }, "Unpaired surrogate"
    );
    expect_invalid(
        [] { static_cast<void>(dans::document::transport::JsonNumber{"1."}); },
        "Constructed invalid JSON number"
    );
    expect_invalid(
        [] { static_cast<void>(JsonValue{std::string{1U, static_cast<char>(0xc0U)}}); },
        "Invalid UTF-8 JSON string"
    );
}

auto verify_canonical_fixture() -> void
{
    using namespace dans::document::transport;

    const auto fixture_path = std::filesystem::path{DANS_TYPESETTING_CANONICAL_FIXTURE};
    const auto source = read_text(fixture_path);
    const auto document = read_canonical_document(fixture_path);
    expect(document.metadata.major == 0U, "Fixture major version changed");
    expect(document.metadata.minor == 1U, "Fixture minor version changed");
    expect(document.metadata.patch == 0U, "Fixture patch version changed");
    expect(document.blocks.size() == 5U, "Fixture block count changed");
    expect(document.blocks.front().type == "dans.core.paragraph", "First fixture type changed");
    expect(document.blocks.back().type == "third.party.block", "Unknown fixture block was lost");
    expect(
        serialize_canonical_document(document) == source,
        "Native canonical normalization differs from the browser normalization"
    );
    const auto output_path = std::filesystem::path{DANS_TYPESETTING_TRANSPORT_TEST_OUTPUT};
    write_canonical_document(document, output_path);
    expect(read_text(output_path) == source, "Canonical file output differs from the fixture");
    expect(
        read_canonical_document(output_path).blocks.size() == document.blocks.size(),
        "Canonical file input lost blocks"
    );

    expect_invalid(
        []
        {
            static_cast<void>(parse_canonical_document(
                R"({"format":"dans.typesetting.document","schemaVersion":2,"documentVersion":{"major":0,"minor":1,"patch":0},"blocks":[]})"
            ));
        },
        "Unknown canonical schema"
    );
    expect_invalid(
        []
        {
            static_cast<void>(parse_canonical_document(
                R"({"format":"dans.typesetting.document","schemaVersion":1,"documentVersion":{"major":0,"minor":1,"patch":0},"blocks":[{"id":"same","type":"x","payload":null},{"id":"same","type":"y","payload":null}]})"
            ));
        },
        "Duplicate canonical block id"
    );
}
}  // namespace

auto main() noexcept -> int
{
    try
    {
        verify_json_parser();
        verify_canonical_fixture();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_transport_test failed: {}", error.what());
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
