// Shared backend-neutral media sizing hints used by image-like plugins.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_MEDIA_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_MEDIA_HPP

#include "common.hpp"

namespace dans::document::plugins
{
// Author intent expressed relative to the width offered by the containing
// layout context. A LaTeX connector commonly maps this to \linewidth.
class RelativeWidth final
{
  public:
    RelativeWidth() = default;

    [[nodiscard]] static auto from_fraction(f64 fraction) -> RelativeWidth;
    [[nodiscard]] static auto from_percent(f64 percent) -> RelativeWidth;
    [[nodiscard]] auto fraction() const noexcept -> f64;

  private:
    explicit RelativeWidth(f64 fraction, int) noexcept;

    f64 fraction_{1.0};
};

// A preferred media-layout box in logical pixels. It intentionally does not
// prescribe a physical DPI: pixel-native exporters can honor it directly,
// while print exporters decide how to map it into physical units.
class PixelExtent final
{
  public:
    PixelExtent(u32 width, u32 height);

    [[nodiscard]] auto width() const noexcept -> u32;
    [[nodiscard]] auto height() const noexcept -> u32;

  private:
    u32 width_{};
    u32 height_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_MEDIA_HPP
