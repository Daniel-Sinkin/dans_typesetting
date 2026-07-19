// src/plugins/image.cpp — validate and implement semantic image content.
#include "plugins/image.hpp"

#include <cmath>
#include <stdexcept>
#include <utility>

namespace dans::document::plugins
{
ImageSource::ImageSource(std::filesystem::path path) : path_{std::move(path)}
{
    if (path_.empty())
    {
        throw std::invalid_argument{"An image source path must not be empty"};
    }
}

auto ImageSource::path() const noexcept -> const std::filesystem::path&
{
    return path_;
}

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

InlineImageHeight::InlineImageHeight(const f64 em) : em_{em}
{
    if (!std::isfinite(em) || em <= 0.0)
    {
        throw std::invalid_argument{"An inline image height must be finite and positive"};
    }
}

auto InlineImageHeight::em() const noexcept -> f64
{
    return em_;
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

InlineImage::InlineImage(ImageSource source, const InlineImageHeight height)
    : source_{std::move(source)}, height_{height}
{
}

auto InlineImage::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto InlineImage::source() const noexcept -> const ImageSource&
{
    return source_;
}

auto InlineImage::height() const noexcept -> InlineImageHeight
{
    return height_;
}

Figure::Figure(
    ImageSource source,
    const std::string_view caption,
    const RelativeWidth width,
    std::optional<PixelExtent> preferred_pixel_extent
)
    : Figure{std::move(source), std::nullopt, caption, width, preferred_pixel_extent}
{
}

Figure::Figure(
    ImageSource source,
    std::optional<ReferenceId> reference_id,
    const std::string_view caption,
    const RelativeWidth width,
    std::optional<PixelExtent> preferred_pixel_extent
)
    : source_{std::move(source)}, reference_id_{std::move(reference_id)}, width_{width},
      preferred_pixel_extent_{preferred_pixel_extent}
{
    if (caption.empty())
    {
        throw std::invalid_argument{"A figure must have a caption"};
    }
    caption_.add<CoreText>(caption);
}

auto Figure::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Figure::source() const noexcept -> const ImageSource&
{
    return source_;
}

auto Figure::reference_id() const noexcept -> const std::optional<ReferenceId>&
{
    return reference_id_;
}

auto Figure::width() const noexcept -> RelativeWidth
{
    return width_;
}

auto Figure::preferred_pixel_extent() const noexcept -> const std::optional<PixelExtent>&
{
    return preferred_pixel_extent_;
}

auto Figure::caption() noexcept -> InlineSequence&
{
    return caption_;
}

auto Figure::caption() const noexcept -> const InlineSequence&
{
    return caption_;
}
}  // namespace dans::document::plugins
