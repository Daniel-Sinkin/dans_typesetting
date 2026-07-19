// src/transport/json.cpp — parse and deterministically format the canonical JSON subset.
#include "transport/json.hpp"

#include <algorithm>
#include <array>
#include <stdexcept>
#include <string>
#include <utility>

namespace
{
using dans::document::transport::JsonNumber;
using dans::document::transport::JsonValue;

auto is_digit(const char character) noexcept -> bool
{
    return character >= '0' && character <= '9';
}

auto is_hex_digit(const char character) noexcept -> bool
{
    return is_digit(character) || (character >= 'a' && character <= 'f')
           || (character >= 'A' && character <= 'F');
}

auto is_valid_number_lexeme(const std::string_view lexeme) noexcept -> bool
{
    auto position = std::size_t{};
    if (position < lexeme.size() && lexeme[position] == '-')
    {
        ++position;
    }
    if (position >= lexeme.size())
    {
        return false;
    }
    if (lexeme[position] == '0')
    {
        ++position;
    }
    else
    {
        if (lexeme[position] < '1' || lexeme[position] > '9')
        {
            return false;
        }
        while (position < lexeme.size() && is_digit(lexeme[position]))
        {
            ++position;
        }
    }
    if (position < lexeme.size() && lexeme[position] == '.')
    {
        ++position;
        const auto fraction_start = position;
        while (position < lexeme.size() && is_digit(lexeme[position]))
        {
            ++position;
        }
        if (position == fraction_start)
        {
            return false;
        }
    }
    if (position < lexeme.size() && (lexeme[position] == 'e' || lexeme[position] == 'E'))
    {
        ++position;
        if (position < lexeme.size() && (lexeme[position] == '+' || lexeme[position] == '-'))
        {
            ++position;
        }
        const auto exponent_start = position;
        while (position < lexeme.size() && is_digit(lexeme[position]))
        {
            ++position;
        }
        if (position == exponent_start)
        {
            return false;
        }
    }
    return position == lexeme.size();
}

auto is_valid_utf8(const std::string_view value) noexcept -> bool
{
    auto position = std::size_t{};
    const auto byte_at = [&value](const std::size_t index) noexcept
    { return static_cast<unsigned char>(value[index]); };
    const auto is_continuation = [&byte_at](const std::size_t index) noexcept
    { return (byte_at(index) & 0xc0U) == 0x80U; };

    while (position < value.size())
    {
        const auto first = byte_at(position);
        if (first <= 0x7fU)
        {
            ++position;
            continue;
        }
        if (first >= 0xc2U && first <= 0xdfU)
        {
            if (position + 1U >= value.size() || !is_continuation(position + 1U))
            {
                return false;
            }
            position += 2U;
            continue;
        }
        if (first >= 0xe0U && first <= 0xefU)
        {
            if (position + 2U >= value.size() || !is_continuation(position + 1U)
                || !is_continuation(position + 2U))
            {
                return false;
            }
            const auto second = byte_at(position + 1U);
            if ((first == 0xe0U && second < 0xa0U) || (first == 0xedU && second >= 0xa0U))
            {
                return false;
            }
            position += 3U;
            continue;
        }
        if (first >= 0xf0U && first <= 0xf4U)
        {
            if (position + 3U >= value.size() || !is_continuation(position + 1U)
                || !is_continuation(position + 2U) || !is_continuation(position + 3U))
            {
                return false;
            }
            const auto second = byte_at(position + 1U);
            if ((first == 0xf0U && second < 0x90U) || (first == 0xf4U && second >= 0x90U))
            {
                return false;
            }
            position += 4U;
            continue;
        }
        return false;
    }
    return true;
}

auto hex_value(const char character) -> unsigned int
{
    if (is_digit(character))
    {
        return static_cast<unsigned int>(character - '0');
    }
    if (character >= 'a' && character <= 'f')
    {
        return static_cast<unsigned int>(character - 'a' + 10);
    }
    if (character >= 'A' && character <= 'F')
    {
        return static_cast<unsigned int>(character - 'A' + 10);
    }
    throw std::logic_error{"A non-hexadecimal digit reached hex_value"};
}

auto append_utf8(std::string& output, const unsigned int code_point) -> void
{
    if (code_point <= 0x7fU)
    {
        output.push_back(static_cast<char>(code_point));
        return;
    }
    if (code_point <= 0x7ffU)
    {
        output.push_back(static_cast<char>(0xc0U | (code_point >> 6U)));
        output.push_back(static_cast<char>(0x80U | (code_point & 0x3fU)));
        return;
    }
    if (code_point <= 0xffffU)
    {
        output.push_back(static_cast<char>(0xe0U | (code_point >> 12U)));
        output.push_back(static_cast<char>(0x80U | ((code_point >> 6U) & 0x3fU)));
        output.push_back(static_cast<char>(0x80U | (code_point & 0x3fU)));
        return;
    }
    if (code_point <= 0x10ffffU)
    {
        output.push_back(static_cast<char>(0xf0U | (code_point >> 18U)));
        output.push_back(static_cast<char>(0x80U | ((code_point >> 12U) & 0x3fU)));
        output.push_back(static_cast<char>(0x80U | ((code_point >> 6U) & 0x3fU)));
        output.push_back(static_cast<char>(0x80U | (code_point & 0x3fU)));
        return;
    }
    throw std::invalid_argument{"JSON Unicode escape is outside the Unicode range"};
}

class Parser final
{
  public:
    explicit Parser(const std::string_view source) noexcept : source_{source}
    {
    }

    [[nodiscard]] auto parse_document() -> JsonValue
    {
        skip_whitespace();
        auto result = parse_value();
        skip_whitespace();
        if (position_ != source_.size())
        {
            fail("Unexpected trailing data");
        }
        return result;
    }

  private:
    [[noreturn]] auto fail(const std::string_view message) const -> void
    {
        throw std::invalid_argument{
            "Invalid JSON at byte " + std::to_string(position_) + ": " + std::string{message}
        };
    }

    auto skip_whitespace() noexcept -> void
    {
        while (position_ < source_.size())
        {
            const auto character = source_[position_];
            if (character != ' ' && character != '\t' && character != '\n' && character != '\r')
            {
                return;
            }
            ++position_;
        }
    }

    [[nodiscard]] auto peek() const -> char
    {
        if (position_ >= source_.size())
        {
            fail("Unexpected end of input");
        }
        return source_[position_];
    }

    auto consume(const char expected) -> void
    {
        if (peek() != expected)
        {
            fail("Unexpected character");
        }
        ++position_;
    }

    auto consume_literal(const std::string_view literal) -> void
    {
        if (source_.substr(position_, literal.size()) != literal)
        {
            fail("Invalid literal");
        }
        position_ += literal.size();
    }

    [[nodiscard]] auto parse_value() -> JsonValue
    {
        switch (peek())
        {
            case 'n':
                consume_literal("null");
                return JsonValue{};
            case 't':
                consume_literal("true");
                return JsonValue{true};
            case 'f':
                consume_literal("false");
                return JsonValue{false};
            case '"':
                return JsonValue{parse_string()};
            case '[':
                return JsonValue{parse_array()};
            case '{':
                return JsonValue{parse_object()};
            case '-':
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                return JsonValue{parse_number()};
            default:
                fail("Expected a JSON value");
        }
    }

    [[nodiscard]] auto parse_string() -> std::string
    {
        consume('"');
        std::string result;
        while (position_ < source_.size())
        {
            const auto character = source_[position_++];
            if (character == '"')
            {
                if (!is_valid_utf8(result))
                {
                    fail("String is not valid UTF-8");
                }
                return result;
            }
            if (static_cast<unsigned char>(character) < 0x20U)
            {
                fail("Unescaped control character in string");
            }
            if (character != '\\')
            {
                result.push_back(character);
                continue;
            }

            if (position_ >= source_.size())
            {
                fail("Incomplete string escape");
            }
            const auto escape = source_[position_++];
            switch (escape)
            {
                case '"':
                case '\\':
                case '/':
                    result.push_back(escape);
                    break;
                case 'b':
                    result.push_back('\b');
                    break;
                case 'f':
                    result.push_back('\f');
                    break;
                case 'n':
                    result.push_back('\n');
                    break;
                case 'r':
                    result.push_back('\r');
                    break;
                case 't':
                    result.push_back('\t');
                    break;
                case 'u':
                    append_unicode_escape(result);
                    break;
                default:
                    fail("Unsupported string escape");
            }
        }
        fail("Unterminated string");
    }

    [[nodiscard]] auto parse_hex_quad() -> unsigned int
    {
        if (source_.size() - position_ < 4U)
        {
            fail("Incomplete Unicode escape");
        }
        auto result = 0U;
        for (auto index = 0U; index < 4U; ++index)
        {
            const auto character = source_[position_++];
            if (!is_hex_digit(character))
            {
                fail("Invalid Unicode escape");
            }
            result = (result << 4U) | hex_value(character);
        }
        return result;
    }

    auto append_unicode_escape(std::string& output) -> void
    {
        auto code_point = parse_hex_quad();
        if (code_point >= 0xd800U && code_point <= 0xdbffU)
        {
            if (source_.size() - position_ < 6U || source_[position_] != '\\'
                || source_[position_ + 1U] != 'u')
            {
                fail("A high surrogate requires a low surrogate");
            }
            position_ += 2U;
            const auto low = parse_hex_quad();
            if (low < 0xdc00U || low > 0xdfffU)
            {
                fail("Invalid low surrogate");
            }
            code_point = 0x10000U + ((code_point - 0xd800U) << 10U) + (low - 0xdc00U);
        }
        else if (code_point >= 0xdc00U && code_point <= 0xdfffU)
        {
            fail("Unexpected low surrogate");
        }
        append_utf8(output, code_point);
    }

    [[nodiscard]] auto parse_number() -> JsonNumber
    {
        const auto start = position_;
        if (peek() == '-')
        {
            ++position_;
        }
        if (position_ >= source_.size())
        {
            fail("Incomplete number");
        }
        if (source_[position_] == '0')
        {
            ++position_;
            if (position_ < source_.size() && is_digit(source_[position_]))
            {
                fail("Leading zeros are not permitted");
            }
        }
        else
        {
            if (source_[position_] < '1' || source_[position_] > '9')
            {
                fail("Invalid number integer part");
            }
            while (position_ < source_.size() && is_digit(source_[position_]))
            {
                ++position_;
            }
        }
        if (position_ < source_.size() && source_[position_] == '.')
        {
            ++position_;
            const auto fraction_start = position_;
            while (position_ < source_.size() && is_digit(source_[position_]))
            {
                ++position_;
            }
            if (fraction_start == position_)
            {
                fail("A decimal point requires fractional digits");
            }
        }
        if (position_ < source_.size() && (source_[position_] == 'e' || source_[position_] == 'E'))
        {
            ++position_;
            if (position_ < source_.size()
                && (source_[position_] == '+' || source_[position_] == '-'))
            {
                ++position_;
            }
            const auto exponent_start = position_;
            while (position_ < source_.size() && is_digit(source_[position_]))
            {
                ++position_;
            }
            if (exponent_start == position_)
            {
                fail("An exponent requires digits");
            }
        }
        return JsonNumber{source_.substr(start, position_ - start)};
    }

    [[nodiscard]] auto parse_array() -> JsonValue::Array
    {
        consume('[');
        skip_whitespace();
        JsonValue::Array values;
        if (peek() == ']')
        {
            ++position_;
            return values;
        }
        while (true)
        {
            skip_whitespace();
            values.push_back(parse_value());
            skip_whitespace();
            const auto separator = peek();
            ++position_;
            if (separator == ']')
            {
                return values;
            }
            if (separator != ',')
            {
                fail("Expected ',' or ']' in array");
            }
        }
    }

    [[nodiscard]] auto parse_object() -> JsonValue::Object
    {
        consume('{');
        skip_whitespace();
        JsonValue::Object members;
        if (peek() == '}')
        {
            ++position_;
            return members;
        }
        while (true)
        {
            skip_whitespace();
            if (peek() != '"')
            {
                fail("Expected a string object key");
            }
            auto key = parse_string();
            if (std::ranges::any_of(
                    members, [&key](const auto& member) noexcept { return member.first == key; }
                ))
            {
                fail("Duplicate object key");
            }
            skip_whitespace();
            consume(':');
            skip_whitespace();
            members.emplace_back(std::move(key), parse_value());
            skip_whitespace();
            const auto separator = peek();
            ++position_;
            if (separator == '}')
            {
                return members;
            }
            if (separator != ',')
            {
                fail("Expected ',' or '}' in object");
            }
        }
    }

    std::string_view source_{};
    std::size_t position_{};
};

auto append_indent(std::string& output, const std::size_t depth) -> void
{
    output.append(depth * 2U, ' ');
}

auto append_escaped_string(std::string& output, const std::string_view value) -> void
{
    constexpr std::array<char, 16> k_hex_digits{
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'
    };
    output.push_back('"');
    for (const char character : value)
    {
        switch (character)
        {
            case '"':
                output.append("\\\"");
                break;
            case '\\':
                output.append("\\\\");
                break;
            case '\b':
                output.append("\\b");
                break;
            case '\f':
                output.append("\\f");
                break;
            case '\n':
                output.append("\\n");
                break;
            case '\r':
                output.append("\\r");
                break;
            case '\t':
                output.append("\\t");
                break;
            default:
                {
                    const auto byte = static_cast<unsigned char>(character);
                    if (byte < 0x20U)
                    {
                        output.append("\\u00");
                        output.push_back(k_hex_digits.at(byte >> 4U));
                        output.push_back(k_hex_digits.at(byte & 0x0fU));
                    }
                    else
                    {
                        output.push_back(character);
                    }
                    break;
                }
        }
    }
    output.push_back('"');
}

auto append_pretty(std::string& output, const JsonValue& value, const std::size_t depth) -> void
{
    if (value.is_null())
    {
        output.append("null");
    }
    else if (value.is_bool())
    {
        output.append(value.as_bool() ? "true" : "false");
    }
    else if (value.is_number())
    {
        output.append(value.as_number().lexeme());
    }
    else if (value.is_string())
    {
        append_escaped_string(output, value.as_string());
    }
    else if (value.is_array())
    {
        const auto& array = value.as_array();
        if (array.empty())
        {
            output.append("[]");
            return;
        }
        output.append("[\n");
        for (auto index = std::size_t{}; index < array.size(); ++index)
        {
            append_indent(output, depth + 1U);
            append_pretty(output, array[index], depth + 1U);
            output.append(index + 1U == array.size() ? "\n" : ",\n");
        }
        append_indent(output, depth);
        output.push_back(']');
    }
    else
    {
        const auto& object = value.as_object();
        if (object.empty())
        {
            output.append("{}");
            return;
        }
        output.append("{\n");
        for (auto index = std::size_t{}; index < object.size(); ++index)
        {
            append_indent(output, depth + 1U);
            append_escaped_string(output, object[index].first);
            output.append(": ");
            append_pretty(output, object[index].second, depth + 1U);
            output.append(index + 1U == object.size() ? "\n" : ",\n");
        }
        append_indent(output, depth);
        output.push_back('}');
    }
}
}  // namespace

namespace dans::document::transport
{
JsonNumber::JsonNumber(const std::string_view lexeme) : lexeme_{lexeme}
{
    if (!is_valid_number_lexeme(lexeme))
    {
        throw std::invalid_argument{"A JSON number requires a valid JSON numeric lexeme"};
    }
}

auto JsonNumber::lexeme() const noexcept -> std::string_view
{
    return lexeme_;
}

JsonValue::JsonValue() noexcept = default;

JsonValue::JsonValue(const bool value) noexcept : value_{value}
{
}

JsonValue::JsonValue(JsonNumber value) : value_{std::move(value)}
{
}

JsonValue::JsonValue(std::string value) : value_{std::move(value)}
{
    if (!is_valid_utf8(std::get<std::string>(value_)))
    {
        throw std::invalid_argument{"A JSON string must contain valid UTF-8"};
    }
}

JsonValue::JsonValue(Array value) : value_{std::move(value)}
{
}

JsonValue::JsonValue(Object value) : value_{std::move(value)}
{
    const auto& object = std::get<Object>(value_);
    for (auto index = std::size_t{}; index < object.size(); ++index)
    {
        if (!is_valid_utf8(object[index].first))
        {
            throw std::invalid_argument{"A JSON object key must contain valid UTF-8"};
        }
        for (auto earlier = std::size_t{}; earlier < index; ++earlier)
        {
            if (object[earlier].first == object[index].first)
            {
                throw std::invalid_argument{"A JSON object must not contain duplicate keys"};
            }
        }
    }
}

auto JsonValue::is_null() const noexcept -> bool
{
    return std::holds_alternative<std::nullptr_t>(value_);
}

auto JsonValue::is_bool() const noexcept -> bool
{
    return std::holds_alternative<bool>(value_);
}

auto JsonValue::is_number() const noexcept -> bool
{
    return std::holds_alternative<JsonNumber>(value_);
}

auto JsonValue::is_string() const noexcept -> bool
{
    return std::holds_alternative<std::string>(value_);
}

auto JsonValue::is_array() const noexcept -> bool
{
    return std::holds_alternative<Array>(value_);
}

auto JsonValue::is_object() const noexcept -> bool
{
    return std::holds_alternative<Object>(value_);
}

auto JsonValue::as_bool() const -> bool
{
    return std::get<bool>(value_);
}

auto JsonValue::as_number() const -> const JsonNumber&
{
    return std::get<JsonNumber>(value_);
}

auto JsonValue::as_string() const -> std::string_view
{
    return std::get<std::string>(value_);
}

auto JsonValue::as_array() const -> const Array&
{
    return std::get<Array>(value_);
}

auto JsonValue::as_object() const -> const Object&
{
    return std::get<Object>(value_);
}

auto JsonValue::parse(const std::string_view source) -> JsonValue
{
    return Parser{source}.parse_document();
}

auto JsonValue::to_pretty_string() const -> std::string
{
    std::string result;
    append_pretty(result, *this, 0U);
    return result;
}
}  // namespace dans::document::transport
