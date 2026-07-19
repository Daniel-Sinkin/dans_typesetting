// Shared safe formatting for graphics assets consumed by LaTeX connectors.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_GRAPHICS_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_GRAPHICS_HPP

#include "common.hpp"

#include <array>
#include <charconv>
#include <filesystem>
#include <stdexcept>
#include <string>
#include <system_error>

namespace dans::document::connectors::latex::detail
{
[[nodiscard]] inline auto lowercase_ascii(std::string text) -> std::string
{
    for (char& character : text)
    {
        if (character >= 'A' && character <= 'Z')
        {
            character = static_cast<char>(character - 'A' + 'a');
        }
    }
    return text;
}

[[nodiscard]] inline auto is_safe_path_character(const char character) noexcept -> bool
{
    const auto is_letter =
        (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z');
    const auto is_digit = character >= '0' && character <= '9';
    return is_letter || is_digit || character == '/' || character == '.' || character == '_'
           || character == '-' || character == ':' || character == ' ';
}

[[nodiscard]] inline auto graphics_path(const std::filesystem::path& path) -> std::string
{
    const auto extension = lowercase_ascii(path.extension().string());
    if (extension != ".pdf" && extension != ".png" && extension != ".jpg" && extension != ".jpeg")
    {
        throw std::runtime_error{
            "The LaTeX graphics connector supports only PDF, PNG, and JPEG assets: " + path.string()
        };
    }

    auto result = path.generic_string();
    for (const char character : result)
    {
        if (!is_safe_path_character(character))
        {
            throw std::runtime_error{
                "The LaTeX graphics connector cannot safely encode this asset path: "
                + path.string()
            };
        }
    }
    return result;
}

[[nodiscard]] inline auto decimal(const f64 value) -> std::string
{
    std::array<char, 64> buffer{};
    const auto result = std::to_chars(buffer.data(), buffer.data() + buffer.size(), value);
    if (result.ec != std::errc{})
    {
        throw std::runtime_error{"Could not format a graphics layout measurement"};
    }
    return {buffer.data(), result.ptr};
}
}  // namespace dans::document::connectors::latex::detail

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_GRAPHICS_HPP
