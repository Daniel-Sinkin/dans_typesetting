// Validate reusable media layout hints independently of concrete media types.
#include "plugins/media.hpp"

#include <cmath>
#include <stdexcept>

namespace dans::document::plugins
{
RelativeWidth::RelativeWidth(const f64 fraction, const int /* validated */) noexcept
    : fraction_{fraction}
{
}

auto RelativeWidth::from_fraction(const f64 fraction) -> RelativeWidth
{
    if (!std::isfinite(fraction) || fraction <= 0.0 || fraction > 1.0)
    {
        throw std::invalid_argument{"A relative width fraction must be finite and in (0, 1]"};
    }
    return RelativeWidth{fraction, 0};
}

auto RelativeWidth::from_percent(const f64 percent) -> RelativeWidth
{
    if (!std::isfinite(percent) || percent <= 0.0 || percent > 100.0)
    {
        throw std::invalid_argument{"A relative width percentage must be finite and in (0, 100]"};
    }
    return RelativeWidth{percent / 100.0, 0};
}

auto RelativeWidth::fraction() const noexcept -> f64
{
    return fraction_;
}

PixelExtent::PixelExtent(const u32 width, const u32 height) : width_{width}, height_{height}
{
    if (width == u32{0} || height == u32{0})
    {
        throw std::invalid_argument{"A preferred pixel extent must have non-zero dimensions"};
    }
}

auto PixelExtent::width() const noexcept -> u32
{
    return width_;
}

auto PixelExtent::height() const noexcept -> u32
{
    return height_;
}
}  // namespace dans::document::plugins
