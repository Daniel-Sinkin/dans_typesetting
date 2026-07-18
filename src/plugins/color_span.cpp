#include "plugins/color_span.hpp"

namespace dans::document::plugins
{
ColorSpan::ColorSpan(const RgbColor color) noexcept : color_{color}
{
}

auto ColorSpan::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto ColorSpan::color() const noexcept -> RgbColor
{
    return color_;
}

auto ColorSpan::inlines() noexcept -> InlineSequence&
{
    return inlines_;
}

auto ColorSpan::inlines() const noexcept -> const InlineSequence&
{
    return inlines_;
}
}  // namespace dans::document::plugins
