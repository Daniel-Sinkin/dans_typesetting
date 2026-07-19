// src/plugins/figure_pair.cpp — validate and implement two-panel figures.
#include "plugins/figure_pair.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::plugins
{
FigurePanel::FigurePanel(
    ImageSource source,
    const std::string_view caption,
    std::optional<ReferenceId> reference_id,
    std::optional<PixelExtent> preferred_pixel_extent
)
    : source_{std::move(source)}, reference_id_{std::move(reference_id)},
      preferred_pixel_extent_{preferred_pixel_extent}
{
    if (caption.empty())
    {
        throw std::invalid_argument{"A figure panel must have a caption"};
    }
    caption_.add<CoreText>(caption);
}

auto FigurePanel::source() const noexcept -> const ImageSource&
{
    return source_;
}

auto FigurePanel::reference_id() const noexcept -> const std::optional<ReferenceId>&
{
    return reference_id_;
}

auto FigurePanel::preferred_pixel_extent() const noexcept -> const std::optional<PixelExtent>&
{
    return preferred_pixel_extent_;
}

auto FigurePanel::caption() noexcept -> InlineSequence&
{
    return caption_;
}

auto FigurePanel::caption() const noexcept -> const InlineSequence&
{
    return caption_;
}

FigurePair::FigurePair(
    FigurePanel first,
    FigurePanel second,
    const std::string_view caption,
    const RelativeWidth panel_width
)
    : FigurePair{std::move(first), std::move(second), std::nullopt, caption, panel_width}
{
}

FigurePair::FigurePair(
    FigurePanel first,
    FigurePanel second,
    std::optional<ReferenceId> reference_id,
    const std::string_view caption,
    const RelativeWidth panel_width
)
    : panels_{std::move(first), std::move(second)}, reference_id_{std::move(reference_id)},
      panel_width_{panel_width}
{
    if (caption.empty())
    {
        throw std::invalid_argument{"A figure pair must have a caption"};
    }
    if (panel_width.fraction() > 0.5)
    {
        throw std::invalid_argument{
            "A horizontal figure-pair panel width must not exceed half the available width"
        };
    }
    for (const auto& panel : panels_)
    {
        const auto& panel_reference = panel.reference_id();
        if (reference_id_.has_value() && panel_reference.has_value()
            && panel_reference.value().value() == reference_id_.value().value())
        {
            throw std::invalid_argument{
                "Figure-pair group and panel reference IDs must be distinct"
            };
        }
    }
    const auto& first_reference = panels_[0].reference_id();
    const auto& second_reference = panels_[1].reference_id();
    if (first_reference.has_value() && second_reference.has_value()
        && first_reference.value().value() == second_reference.value().value())
    {
        throw std::invalid_argument{"Figure-pair panel reference IDs must be distinct"};
    }
    caption_.add<CoreText>(caption);
}

auto FigurePair::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto FigurePair::panels() noexcept -> std::span<FigurePanel, 2>
{
    return panels_;
}

auto FigurePair::panels() const noexcept -> std::span<const FigurePanel, 2>
{
    return panels_;
}

auto FigurePair::reference_id() const noexcept -> const std::optional<ReferenceId>&
{
    return reference_id_;
}

auto FigurePair::panel_width() const noexcept -> RelativeWidth
{
    return panel_width_;
}

auto FigurePair::caption() noexcept -> InlineSequence&
{
    return caption_;
}

auto FigurePair::caption() const noexcept -> const InlineSequence&
{
    return caption_;
}
}  // namespace dans::document::plugins
