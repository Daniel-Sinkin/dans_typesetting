// src/layout/page_layout.hpp — backend-neutral fixed-point page display lists.
#ifndef DANS_TYPESETTING_SRC_LAYOUT_PAGE_LAYOUT_HPP
#define DANS_TYPESETTING_SRC_LAYOUT_PAGE_LAYOUT_HPP

#include "common.hpp"

#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

namespace dans::document::layout
{
class ScaledPoint final
{
  public:
    static constexpr i64 k_units_per_tex_point = 65'536;

    constexpr ScaledPoint() noexcept = default;

    [[nodiscard]] static auto from_tex_points(double value) -> ScaledPoint
    {
        return from_raw(static_cast<i64>(std::llround(value * k_units_per_tex_point)));
    }

    [[nodiscard]] static constexpr auto from_raw(const i64 value) noexcept -> ScaledPoint
    {
        return ScaledPoint{value};
    }

    [[nodiscard]] constexpr auto raw() const noexcept -> i64
    {
        return value_;
    }

    [[nodiscard]] auto tex_points() const noexcept -> double
    {
        return static_cast<double>(value_) / static_cast<double>(k_units_per_tex_point);
    }

    constexpr auto operator+=(const ScaledPoint other) noexcept -> ScaledPoint&
    {
        value_ += other.value_;
        return *this;
    }

    constexpr auto operator-=(const ScaledPoint other) noexcept -> ScaledPoint&
    {
        value_ -= other.value_;
        return *this;
    }

    friend constexpr auto operator+(ScaledPoint left, const ScaledPoint right) noexcept
        -> ScaledPoint
    {
        left += right;
        return left;
    }

    friend constexpr auto operator-(ScaledPoint left, const ScaledPoint right) noexcept
        -> ScaledPoint
    {
        left -= right;
        return left;
    }

    friend constexpr auto operator<=>(const ScaledPoint&, const ScaledPoint&) = default;

  private:
    explicit constexpr ScaledPoint(const i64 value) noexcept : value_{value}
    {
    }

    i64 value_{};
};

struct LayoutPoint
{
    ScaledPoint x{};
    ScaledPoint y{};
};

struct PageSize
{
    ScaledPoint width{};
    ScaledPoint height{};
};

enum class GlyphRunRole : u8
{
    body,
    page_number,
};

struct GlyphPlacement
{
    u8 character_code{};
    char32_t unicode{};
    ScaledPoint x_offset{};
    ScaledPoint advance{};
};

struct GlyphRun
{
    std::string font_key{};
    ScaledPoint font_size{};
    LayoutPoint baseline{};
    GlyphRunRole role{};
    std::vector<GlyphPlacement> glyphs{};
};

struct Page
{
    PageSize size{};
    std::vector<GlyphRun> glyph_runs{};
};

struct PagedDocument
{
    std::vector<Page> pages{};
};
}  // namespace dans::document::layout

#endif  // DANS_TYPESETTING_SRC_LAYOUT_PAGE_LAYOUT_HPP
