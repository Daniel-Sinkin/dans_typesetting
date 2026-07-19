// src/plugins/figure_pair.hpp — define an opinionated two-panel figure block.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_FIGURE_PAIR_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_FIGURE_PAIR_HPP

#include "plugins/image.hpp"

#include <array>
#include <optional>
#include <span>
#include <string_view>

namespace dans::document::plugins
{
// One panel is semantic image data with its own rich caption and optional
// reference target. Visible subfigure letters remain writer-owned.
class FigurePanel final
{
  public:
    FigurePanel(
        ImageSource source,
        std::string_view caption,
        std::optional<ReferenceId> reference_id = std::nullopt,
        std::optional<PixelExtent> preferred_pixel_extent = std::nullopt
    );

    [[nodiscard]] auto source() const noexcept -> const ImageSource&;
    [[nodiscard]] auto reference_id() const noexcept -> const std::optional<ReferenceId>&;
    [[nodiscard]] auto preferred_pixel_extent() const noexcept -> const std::optional<PixelExtent>&;
    [[nodiscard]] auto caption() noexcept -> InlineSequence&;
    [[nodiscard]] auto caption() const noexcept -> const InlineSequence&;

  private:
    ImageSource source_;
    std::optional<ReferenceId> reference_id_{};
    std::optional<PixelExtent> preferred_pixel_extent_{};
    InlineSequence caption_{};
};

// The first composite-figure primitive deliberately supports exactly two
// horizontal panels. More general grids can be introduced as a separate
// extension after their layout and authoring contracts are understood.
class FigurePair final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.image.figure_pair";

    FigurePair(
        FigurePanel first,
        FigurePanel second,
        std::string_view caption,
        RelativeWidth panel_width = RelativeWidth::from_percent(48.0)
    );
    FigurePair(
        FigurePanel first,
        FigurePanel second,
        std::optional<ReferenceId> reference_id,
        std::string_view caption,
        RelativeWidth panel_width = RelativeWidth::from_percent(48.0)
    );

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto panels() noexcept -> std::span<FigurePanel, 2>;
    [[nodiscard]] auto panels() const noexcept -> std::span<const FigurePanel, 2>;
    [[nodiscard]] auto reference_id() const noexcept -> const std::optional<ReferenceId>&;
    [[nodiscard]] auto panel_width() const noexcept -> RelativeWidth;
    [[nodiscard]] auto caption() noexcept -> InlineSequence&;
    [[nodiscard]] auto caption() const noexcept -> const InlineSequence&;

  private:
    std::array<FigurePanel, 2> panels_;
    std::optional<ReferenceId> reference_id_{};
    RelativeWidth panel_width_{};
    InlineSequence caption_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_FIGURE_PAIR_HPP
