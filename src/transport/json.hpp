// src/transport/json.hpp — a small ordered JSON value used by canonical transport.
#ifndef DANS_TYPESETTING_SRC_TRANSPORT_JSON_HPP
#define DANS_TYPESETTING_SRC_TRANSPORT_JSON_HPP

#include <cstddef>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

namespace dans::document::transport
{
class JsonNumber final
{
  public:
    explicit JsonNumber(std::string_view lexeme);

    [[nodiscard]] auto lexeme() const noexcept -> std::string_view;

  private:
    std::string lexeme_{};
};

class JsonValue final
{
  public:
    using Array = std::vector<JsonValue>;
    using Object = std::vector<std::pair<std::string, JsonValue>>;

    JsonValue() noexcept;
    explicit JsonValue(bool value) noexcept;
    explicit JsonValue(JsonNumber value);
    explicit JsonValue(std::string value);
    explicit JsonValue(Array value);
    explicit JsonValue(Object value);

    [[nodiscard]] auto is_null() const noexcept -> bool;
    [[nodiscard]] auto is_bool() const noexcept -> bool;
    [[nodiscard]] auto is_number() const noexcept -> bool;
    [[nodiscard]] auto is_string() const noexcept -> bool;
    [[nodiscard]] auto is_array() const noexcept -> bool;
    [[nodiscard]] auto is_object() const noexcept -> bool;

    [[nodiscard]] auto as_bool() const -> bool;
    [[nodiscard]] auto as_number() const -> const JsonNumber&;
    [[nodiscard]] auto as_string() const -> std::string_view;
    [[nodiscard]] auto as_array() const -> const Array&;
    [[nodiscard]] auto as_object() const -> const Object&;

    [[nodiscard]] static auto parse(std::string_view source) -> JsonValue;
    [[nodiscard]] auto to_pretty_string() const -> std::string;

  private:
    using Storage = std::variant<std::nullptr_t, bool, JsonNumber, std::string, Array, Object>;

    Storage value_{nullptr};
};
}  // namespace dans::document::transport

#endif  // DANS_TYPESETTING_SRC_TRANSPORT_JSON_HPP
