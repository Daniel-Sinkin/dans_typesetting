// src/transport/document_transport.hpp — versioned canonical document envelopes.
#ifndef DANS_TYPESETTING_SRC_TRANSPORT_DOCUMENT_TRANSPORT_HPP
#define DANS_TYPESETTING_SRC_TRANSPORT_DOCUMENT_TRANSPORT_HPP

#include "document.hpp"
#include "transport/json.hpp"

#include <filesystem>
#include <string>
#include <string_view>
#include <vector>

namespace dans::document::transport
{
inline constexpr std::string_view k_canonical_document_format = "dans.typesetting.document";
inline constexpr u32 k_canonical_document_schema_version = 1U;

// The core transport deliberately knows only the common node envelope. Plugin
// modules own the schema of payload and can decode it independently.
struct CanonicalNode
{
    std::string id{};
    std::string type{};
    JsonValue payload{};
};

struct CanonicalDocument
{
    Metadata metadata{};
    std::vector<CanonicalNode> blocks{};
};

[[nodiscard]] auto parse_canonical_node(const JsonValue& value, std::string_view context)
    -> CanonicalNode;
[[nodiscard]] auto parse_canonical_document(std::string_view source) -> CanonicalDocument;
[[nodiscard]] auto serialize_canonical_document(const CanonicalDocument& document) -> std::string;

[[nodiscard]] auto read_canonical_document(const std::filesystem::path& input_path)
    -> CanonicalDocument;
auto write_canonical_document(
    const CanonicalDocument& document, const std::filesystem::path& output_path
) -> void;
}  // namespace dans::document::transport

#endif  // DANS_TYPESETTING_SRC_TRANSPORT_DOCUMENT_TRANSPORT_HPP
