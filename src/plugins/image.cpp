// src/plugins/image.cpp — validate and implement semantic image content.
#include "plugins/image.hpp"

#include "plugins/text.hpp"

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
    caption_.add<Text>(caption);
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
