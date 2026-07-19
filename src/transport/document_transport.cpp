// src/transport/document_transport.cpp — validate and preserve canonical envelopes.
#include "transport/document_transport.hpp"

#include <charconv>
#include <cstdint>
#include <fstream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <unordered_set>
#include <utility>

namespace
{
using dans::document::Metadata;
using dans::document::transport::CanonicalDocument;
using dans::document::transport::CanonicalNode;
using dans::document::transport::JsonNumber;
using dans::document::transport::JsonValue;

[[nodiscard]] auto find_member(
    const JsonValue::Object& object, const std::string_view name, const std::string_view context
) -> const JsonValue&
{
    for (const auto& [key, value] : object)
    {
        if (key == name)
        {
            return value;
        }
    }
    throw std::invalid_argument{
        std::string{context} + " requires a '" + std::string{name} + "' field"
    };
}

[[nodiscard]] auto require_object(const JsonValue& value, const std::string_view context)
    -> const JsonValue::Object&
{
    if (!value.is_object())
    {
        throw std::invalid_argument{std::string{context} + " must be an object"};
    }
    return value.as_object();
}

[[nodiscard]] auto require_array(const JsonValue& value, const std::string_view context)
    -> const JsonValue::Array&
{
    if (!value.is_array())
    {
        throw std::invalid_argument{std::string{context} + " must be an array"};
    }
    return value.as_array();
}

[[nodiscard]] auto require_string(const JsonValue& value, const std::string_view context)
    -> std::string
{
    if (!value.is_string())
    {
        throw std::invalid_argument{std::string{context} + " must be a string"};
    }
    return std::string{value.as_string()};
}

template <typename Integer>
[[nodiscard]] auto require_unsigned_integer(const JsonValue& value, const std::string_view context)
    -> Integer
{
    static_assert(std::is_unsigned_v<Integer>);
    if (!value.is_number())
    {
        throw std::invalid_argument{std::string{context} + " must be a non-negative integer"};
    }

    const auto lexeme = value.as_number().lexeme();
    Integer result{};
    const auto [end, error] = std::from_chars(lexeme.data(), lexeme.data() + lexeme.size(), result);
    if (error != std::errc{} || end != lexeme.data() + lexeme.size())
    {
        throw std::invalid_argument{std::string{context} + " must be a non-negative integer"};
    }
    return result;
}

[[nodiscard]] auto parse_metadata(const JsonValue& value) -> Metadata
{
    const auto& object = require_object(value, "Document envelope.documentVersion");
    return Metadata{
        .major = require_unsigned_integer<dans::u16>(
            find_member(object, "major", "Document version"), "Document version.major"
        ),
        .minor = require_unsigned_integer<dans::u16>(
            find_member(object, "minor", "Document version"), "Document version.minor"
        ),
        .patch = require_unsigned_integer<dans::u32>(
            find_member(object, "patch", "Document version"), "Document version.patch"
        ),
    };
}

[[nodiscard]] auto parse_node(const JsonValue& value, const std::string_view context)
    -> CanonicalNode
{
    const auto context_text = std::string{context};
    const auto& object = require_object(value, context);
    auto id = require_string(find_member(object, "id", context), context_text + ".id");
    auto type = require_string(find_member(object, "type", context), context_text + ".type");
    if (id.empty() || type.empty())
    {
        throw std::invalid_argument{context_text + " requires non-empty id and type fields"};
    }
    return CanonicalNode{
        .id = std::move(id),
        .type = std::move(type),
        .payload = find_member(object, "payload", context),
    };
}

[[nodiscard]] auto number(const std::uint64_t value) -> JsonValue
{
    return JsonValue{JsonNumber{std::to_string(value)}};
}

[[nodiscard]] auto node_to_json(const CanonicalNode& node) -> JsonValue
{
    if (node.id.empty() || node.type.empty())
    {
        throw std::invalid_argument{"Canonical nodes require non-empty id and type fields"};
    }
    return JsonValue{JsonValue::Object{
        {"id", JsonValue{node.id}},
        {"type", JsonValue{node.type}},
        {"payload", node.payload},
    }};
}

[[nodiscard]] auto document_to_json(const CanonicalDocument& document) -> JsonValue
{
    std::unordered_set<std::string_view> ids;
    JsonValue::Array blocks;
    blocks.reserve(document.blocks.size());
    for (const auto& block : document.blocks)
    {
        if (!ids.emplace(block.id).second)
        {
            throw std::invalid_argument{
                "Canonical document contains duplicate block id: " + block.id
            };
        }
        blocks.push_back(node_to_json(block));
    }

    const auto& version = document.metadata;
    return JsonValue{JsonValue::Object{
        {"format", JsonValue{std::string{dans::document::transport::k_canonical_document_format}}},
        {"schemaVersion", number(dans::document::transport::k_canonical_document_schema_version)},
        {"documentVersion",
         JsonValue{JsonValue::Object{
             {"major", number(version.major)},
             {"minor", number(version.minor)},
             {"patch", number(version.patch)},
         }}},
        {"blocks", JsonValue{std::move(blocks)}},
    }};
}
}  // namespace

namespace dans::document::transport
{
auto parse_canonical_node(const JsonValue& value, const std::string_view context) -> CanonicalNode
{
    if (context.empty())
    {
        throw std::invalid_argument{"A canonical-node parse context cannot be empty"};
    }
    return parse_node(value, context);
}

auto parse_canonical_document(const std::string_view source) -> CanonicalDocument
{
    const auto root = JsonValue::parse(source);
    const auto& envelope = require_object(root, "Document envelope");
    const auto format =
        require_string(find_member(envelope, "format", "Document envelope"), "Document format");
    const auto schema_version = require_unsigned_integer<u32>(
        find_member(envelope, "schemaVersion", "Document envelope"), "Document schemaVersion"
    );
    if (format != k_canonical_document_format
        || schema_version != k_canonical_document_schema_version)
    {
        throw std::invalid_argument{"Unsupported canonical document format or schema version"};
    }

    CanonicalDocument document{
        .metadata = parse_metadata(find_member(envelope, "documentVersion", "Document envelope")),
        .blocks = {},
    };
    const auto& blocks =
        require_array(find_member(envelope, "blocks", "Document envelope"), "Document blocks");
    document.blocks.reserve(blocks.size());
    std::unordered_set<std::string> ids;
    for (auto index = std::size_t{}; index < blocks.size(); ++index)
    {
        auto node = parse_node(blocks[index], "Block " + std::to_string(index));
        if (!ids.emplace(node.id).second)
        {
            throw std::invalid_argument{
                "Canonical document contains duplicate block id: " + node.id
            };
        }
        document.blocks.push_back(std::move(node));
    }
    return document;
}

auto serialize_canonical_document(const CanonicalDocument& document) -> std::string
{
    return document_to_json(document).to_pretty_string() + '\n';
}

auto read_canonical_document(const std::filesystem::path& input_path) -> CanonicalDocument
{
    std::ifstream input{input_path, std::ios::binary};
    if (!input)
    {
        throw std::runtime_error{"Could not open canonical document: " + input_path.string()};
    }
    const std::string source{
        std::istreambuf_iterator<char>{input}, std::istreambuf_iterator<char>{}
    };
    if (!input.eof() && input.fail())
    {
        throw std::runtime_error{"Could not read canonical document: " + input_path.string()};
    }
    return parse_canonical_document(source);
}

auto write_canonical_document(
    const CanonicalDocument& document, const std::filesystem::path& output_path
) -> void
{
    std::ofstream output{output_path, std::ios::binary | std::ios::trunc};
    if (!output)
    {
        throw std::runtime_error{
            "Could not open canonical document output: " + output_path.string()
        };
    }
    output << serialize_canonical_document(document);
    if (!output)
    {
        throw std::runtime_error{"Could not write canonical document: " + output_path.string()};
    }
}
}  // namespace dans::document::transport
