// src/connectors/transport/paragraph.cpp — validate and materialize paragraph plugin payloads.
#include "connectors/transport/paragraph.hpp"

#include "plugins/paragraph.hpp"
#include "plugins/text.hpp"

#include <stdexcept>
#include <string>
#include <string_view>
#include <unordered_set>

namespace
{
using dans::document::plugins::TextStyle;
using dans::document::transport::JsonValue;

[[nodiscard]] auto require_object(const JsonValue& value, const std::string_view context)
    -> const JsonValue::Object&
{
    if (!value.is_object())
    {
        throw std::invalid_argument{std::string{context} + " must be an object"};
    }
    return value.as_object();
}

[[nodiscard]] auto require_member(
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

[[nodiscard]] auto require_string(const JsonValue& value, const std::string_view context)
    -> std::string_view
{
    if (!value.is_string())
    {
        throw std::invalid_argument{std::string{context} + " must be a string"};
    }
    return value.as_string();
}

[[nodiscard]] auto require_text_style(const JsonValue& value) -> TextStyle
{
    const auto style = require_string(value, "Core Text payload.style");
    if (style == "normal")
    {
        return TextStyle::normal;
    }
    if (style == "bold")
    {
        return TextStyle::bold;
    }
    if (style == "italic")
    {
        return TextStyle::italic;
    }
    if (style == "bold_italic")
    {
        return TextStyle::bold_italic;
    }
    throw std::invalid_argument{"Core Text payload.style is invalid"};
}
}  // namespace

namespace dans::document::connectors::transport
{
auto ParagraphMaterializer::block_type_id() const noexcept -> std::string_view
{
    return plugins::Paragraph::k_type_id;
}

auto ParagraphMaterializer::materialize(
    const document::transport::CanonicalNode& node,
    const document::transport::DocumentMaterializer& materializer
) const -> std::unique_ptr<DocumentBlock>
{
    const auto& payload = require_object(node.payload, "Paragraph payload");
    const auto& encoded_inlines = require_member(payload, "inlines", "Paragraph payload");
    if (!encoded_inlines.is_array())
    {
        throw std::invalid_argument{"Paragraph payload.inlines must be an array"};
    }

    auto paragraph = std::make_unique<plugins::Paragraph>();
    const auto& inlines = encoded_inlines.as_array();
    if (inlines.empty())
    {
        throw std::invalid_argument{"Paragraph payload.inlines must not be empty"};
    }
    std::unordered_set<std::string> inline_ids;
    for (usize index{}; index < inlines.size(); ++index)
    {
        auto inline_node = document::transport::parse_canonical_node(
            inlines[index], "Paragraph inline " + std::to_string(index)
        );
        if (!inline_ids.emplace(inline_node.id).second)
        {
            throw std::invalid_argument{"Duplicate paragraph inline ID: " + inline_node.id};
        }
        paragraph->inlines().append(materializer.materialize_inline(inline_node));
    }
    return paragraph;
}

auto TextMaterializer::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Text::k_type_id;
}

auto TextMaterializer::materialize(
    const document::transport::CanonicalNode& node, const document::transport::DocumentMaterializer&
) const -> std::unique_ptr<plugins::InlineNode>
{
    const auto& payload = require_object(node.payload, "Core Text payload");
    const auto text = require_string(
        require_member(payload, "text", "Core Text payload"), "Core Text payload.text"
    );
    const auto style = require_text_style(require_member(payload, "style", "Core Text payload"));
    return std::make_unique<plugins::Text>(text, style);
}
}  // namespace dans::document::connectors::transport
