// src/plugins/image.hpp — define inline-image and referenceable-figure document content.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_IMAGE_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_IMAGE_HPP

#include "document.hpp"
#include "plugins/inline_sequence.hpp"
#include "reference_id.hpp"

#include <filesystem>
#include <optional>
#include <string_view>

namespace dans::document::plugins
{
// The source asset is semantic data. Format support and path encoding remain
// connector concerns.
class ImageSource final
{
  public:
    explicit ImageSource(std::filesystem::path path);

    [[nodiscard]] auto path() const noexcept -> const std::filesystem::path&;

  private:
    std::filesystem::path path_{};
};

// Author intent expressed relative to the width offered by the containing
// layout context. A LaTeX figure maps this to \linewidth.
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

class InlineImageHeight final
{
  public:
    InlineImageHeight() = default;
    explicit InlineImageHeight(f64 em);

    [[nodiscard]] auto em() const noexcept -> f64;

  private:
    f64 em_{1.0};
};

// A preferred image-layout box in logical pixels. It intentionally does not
// prescribe a physical DPI: pixel-native exporters can honor it directly,
// while print exporters decide how (or whether) to map it into physical units.
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

// A small image participating in an Inline Sequence. Its height
// is expressed in em so emoji-like assets follow the surrounding text size.
class InlineImage final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.image.inline";

    explicit InlineImage(ImageSource source, InlineImageHeight height = {});

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto source() const noexcept -> const ImageSource&;
    [[nodiscard]] auto height() const noexcept -> InlineImageHeight;

  private:
    ImageSource source_;
    InlineImageHeight height_{};
};

// A captioned block image with an optional semantic reference target. Captions
// use the shared Inline Sequence contract, so inline extensions such as math and
// colour work there without Figure depending on their concrete implementations.
class Figure final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.image.figure";

    Figure(
        ImageSource source,
        std::string_view caption,
        RelativeWidth width = {},
        std::optional<PixelExtent> preferred_pixel_extent = std::nullopt
    );
    Figure(
        ImageSource source,
        std::optional<ReferenceId> reference_id,
        std::string_view caption,
        RelativeWidth width = {},
        std::optional<PixelExtent> preferred_pixel_extent = std::nullopt
    );

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto source() const noexcept -> const ImageSource&;
    [[nodiscard]] auto reference_id() const noexcept -> const std::optional<ReferenceId>&;
    [[nodiscard]] auto width() const noexcept -> RelativeWidth;
    [[nodiscard]] auto preferred_pixel_extent() const noexcept -> const std::optional<PixelExtent>&;
    [[nodiscard]] auto caption() noexcept -> InlineSequence&;
    [[nodiscard]] auto caption() const noexcept -> const InlineSequence&;

  private:
    ImageSource source_;
    std::optional<ReferenceId> reference_id_{};
    RelativeWidth width_{};
    std::optional<PixelExtent> preferred_pixel_extent_{};
    InlineSequence caption_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_IMAGE_HPP
