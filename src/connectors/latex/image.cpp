// src/connectors/latex/image.cpp — render inline images and figures as LaTeX.
#include "connectors/latex/image.hpp"

#include <array>
#include <charconv>
#include <filesystem>
#include <stdexcept>
#include <string>
#include <system_error>
#include <utility>

namespace
{
auto is_ascii_letter(const char character) noexcept -> bool
{
    return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z');
}

auto is_ascii_digit(const char character) noexcept -> bool
{
    return character >= '0' && character <= '9';
}

auto is_safe_latex_path_character(const char character) noexcept -> bool
{
    return is_ascii_letter(character) || is_ascii_digit(character) || character == '/'
           || character == '.' || character == '_' || character == '-' || character == ':'
           || character == ' ';
}

auto lowercase_ascii(std::string text) -> std::string
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

auto latex_image_path(const std::filesystem::path& path) -> std::string
{
    const auto extension = lowercase_ascii(path.extension().string());
    if (extension != ".pdf" && extension != ".png" && extension != ".jpg" && extension != ".jpeg")
    {
        throw std::runtime_error{
            "The LaTeX image connector supports only PDF, PNG, and JPEG assets: " + path.string()
        };
    }

    auto result = path.generic_string();
    for (const char character : result)
    {
        if (!is_safe_latex_path_character(character))
        {
            throw std::runtime_error{
                "The LaTeX image connector cannot safely encode this image path: " + path.string()
            };
        }
    }
    return result;
}

auto decimal(const dans::f64 value) -> std::string
{
    std::array<char, 64> buffer{};
    const auto result = std::to_chars(buffer.data(), buffer.data() + buffer.size(), value);
    if (result.ec != std::errc{})
    {
        throw std::runtime_error{"Could not format an image layout measurement"};
    }
    return {buffer.data(), result.ptr};
}
}  // namespace

namespace dans::document::connectors::latex
{
auto InlineImageLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::InlineImage::k_type_id;
}

auto InlineImageLatexAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphLatexOutput& output
) const -> void
{
    const auto* image = dynamic_cast<const plugins::InlineImage*>(&node);
    if (image == nullptr)
    {
        throw std::invalid_argument{"The inline-image adapter received a different inline type"};
    }

    output.write_raw("\\raisebox{-0.15em}{\\includegraphics[height=");
    output.write_raw(decimal(image->height().em()));
    output.write_raw("em]{");
    output.write_raw(latex_image_path(image->source().path()));
    output.write_raw("}}");
}

FigureLatexAdapter::FigureLatexAdapter(
    std::shared_ptr<const CoreParagraphInlineLatexRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A figure LaTeX adapter requires an inline renderer"};
    }
}

auto FigureLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Figure::k_type_id;
}

auto FigureLatexAdapter::serialize(const DocumentBlock& block, writers::LatexOutput& output) const
    -> void
{
    const auto* figure = dynamic_cast<const plugins::Figure*>(&block);
    if (figure == nullptr)
    {
        throw std::invalid_argument{"The figure adapter received a different block type"};
    }

    output.write_raw("\\begin{figure}[htbp]\n\\centering\n\\includegraphics[width=");
    output.write_raw(decimal(figure->width().fraction()));
    output.write_raw("\\linewidth]{");
    output.write_raw(latex_image_path(figure->source().path()));
    output.write_raw("}\n\\caption{");
    inline_renderer_->serialize(figure->caption(), output);
    output.write_raw("}\n\\label{");
    output.write_raw(figure->reference_id().value());
    output.write_raw("}\n\\end{figure}\n\n");
}
}  // namespace dans::document::connectors::latex
