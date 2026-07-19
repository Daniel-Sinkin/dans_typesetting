// Validate Python plot source without interpreting or executing it.
#include "plugins/python_plot.hpp"

#include <algorithm>
#include <cctype>
#include <stdexcept>
#include <utility>

namespace dans::document::plugins
{
PythonPlot::PythonPlot(
    std::string source, const RelativeWidth width, const PixelExtent target_pixel_extent
)
    : source_{std::move(source)}, width_{width}, target_pixel_extent_{target_pixel_extent}
{
    const auto contains_non_whitespace = std::ranges::any_of(
        source_,
        [](const char character)
        { return std::isspace(static_cast<unsigned char>(character)) == 0; }
    );
    if (!contains_non_whitespace)
    {
        throw std::invalid_argument{"Python plot source must not be empty"};
    }
    if (source_.size() > k_source_maximum_bytes)
    {
        throw std::invalid_argument{"Python plot source exceeds 100,000 UTF-8 bytes"};
    }
    if (target_pixel_extent.width() < k_extent_minimum
        || target_pixel_extent.width() > k_extent_maximum
        || target_pixel_extent.height() < k_extent_minimum
        || target_pixel_extent.height() > k_extent_maximum)
    {
        throw std::invalid_argument{"Python plot target dimensions must be in [64, 4096]"};
    }
}

auto PythonPlot::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto PythonPlot::source() const noexcept -> std::string_view
{
    return source_;
}

auto PythonPlot::width() const noexcept -> RelativeWidth
{
    return width_;
}

auto PythonPlot::target_pixel_extent() const noexcept -> PixelExtent
{
    return target_pixel_extent_;
}
}  // namespace dans::document::plugins
