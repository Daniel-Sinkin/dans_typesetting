// Validate and expose Padding's single named block-consumption endpoint.
#include "plugins/padding.hpp"

#include <cmath>
#include <stdexcept>

namespace dans::document::plugins
{
namespace
{
auto valid_inset(const f64 value) noexcept -> bool
{
    return std::isfinite(value) && value >= 0.0;
}
}  // namespace

Padding::Padding(const PaddingInsets insets) : insets_{insets}
{
    if (!valid_inset(insets_.top_em) || !valid_inset(insets_.right_em)
        || !valid_inset(insets_.bottom_em) || !valid_inset(insets_.left_em))
    {
        throw std::invalid_argument{"Padding insets must be finite non-negative em values"};
    }
}

auto Padding::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Padding::child_sequence_count() const noexcept -> usize
{
    return 1;
}

auto Padding::child_sequence_id(const usize index) const -> std::string_view
{
    if (index != 0)
    {
        throw std::out_of_range{"Padding exposes only its content child sequence"};
    }
    return k_content_sequence_id;
}

auto Padding::child_sequence(const usize index) const -> const BlockSequence&
{
    if (index != 0)
    {
        throw std::out_of_range{"Padding exposes only its content child sequence"};
    }
    return content_;
}

auto Padding::insets() const noexcept -> PaddingInsets
{
    return insets_;
}

auto Padding::content() noexcept -> BlockSequence&
{
    return content_;
}

auto Padding::content() const noexcept -> const BlockSequence&
{
    return content_;
}
}  // namespace dans::document::plugins
