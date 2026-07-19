// src/plugins/latex_math.cpp — validate and implement LaTeX-authored math nodes.
#include "plugins/latex_math.hpp"

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace dans::document::plugins
{
namespace
{
auto validate_source(const std::string_view source, const bool allow_line_breaks) -> void
{
    if (source.find_first_not_of(" \t\n\r") == std::string_view::npos)
    {
        throw std::invalid_argument{"LaTeX math source must not be empty"};
    }
    if (source.contains('$'))
    {
        throw std::invalid_argument{"LaTeX math source must omit the implicit math delimiters"};
    }
    if (!allow_line_breaks
        && std::ranges::any_of(
            source, [](const char character) { return character == '\n' || character == '\r'; }
        ))
    {
        throw std::invalid_argument{"Inline LaTeX math source must be single-line"};
    }
}
}  // namespace

LatexMathInline::LatexMathInline(const std::string_view source) : source_{source}
{
    validate_source(source_, false);
}

auto LatexMathInline::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto LatexMathInline::source() const noexcept -> std::string_view
{
    return source_;
}

LatexMathDisplay::LatexMathDisplay(
    const std::string_view source,
    const LatexMathNumbering numbering,
    std::optional<ReferenceId> reference_id
)
    : source_{source}, numbering_{numbering}, reference_id_{std::move(reference_id)}
{
    validate_source(source_, true);
    if (numbering_ == LatexMathNumbering::unnumbered && reference_id_.has_value())
    {
        throw std::invalid_argument{"Unnumbered LaTeX math cannot publish a reference target"};
    }
}

auto LatexMathDisplay::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto LatexMathDisplay::source() const noexcept -> std::string_view
{
    return source_;
}

auto LatexMathDisplay::numbering() const noexcept -> LatexMathNumbering
{
    return numbering_;
}

auto LatexMathDisplay::reference_id() const noexcept -> const std::optional<ReferenceId>&
{
    return reference_id_;
}
}  // namespace dans::document::plugins
