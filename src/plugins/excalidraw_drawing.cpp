// Validate and implement the semantic Excalidraw drawing contract.
#include "plugins/excalidraw_drawing.hpp"

#include <cmath>
#include <stdexcept>
#include <utility>

namespace dans::document::plugins
{
DrawingWidth::DrawingWidth(const f64 fraction, const int /* validated */) noexcept
    : fraction_{fraction}
{
}

auto DrawingWidth::from_fraction(const f64 fraction) -> DrawingWidth
{
    if (!std::isfinite(fraction) || fraction <= 0.0 || fraction > 1.0)
    {
        throw std::invalid_argument{"A drawing width fraction must be finite and in (0, 1]"};
    }
    return DrawingWidth{fraction, 0};
}

auto DrawingWidth::from_percent(const f64 percent) -> DrawingWidth
{
    if (!std::isfinite(percent) || percent <= 0.0 || percent > 100.0)
    {
        throw std::invalid_argument{"A drawing width percentage must be finite and in (0, 100]"};
    }
    return DrawingWidth{percent / 100.0, 0};
}

auto DrawingWidth::fraction() const noexcept -> f64
{
    return fraction_;
}

ExcalidrawDrawing::ExcalidrawDrawing(
    const std::string_view scene_json,
    ReferenceId reference_id,
    const std::string_view caption,
    const DrawingWidth width
)
    : scene_json_{scene_json}, reference_id_{std::move(reference_id)}, caption_{caption},
      width_{width}
{
    if (scene_json.empty())
    {
        throw std::invalid_argument{"An Excalidraw drawing requires scene data"};
    }
    if (caption.empty())
    {
        throw std::invalid_argument{"An Excalidraw drawing requires a caption"};
    }
}

auto ExcalidrawDrawing::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto ExcalidrawDrawing::scene_json() const noexcept -> std::string_view
{
    return scene_json_;
}

auto ExcalidrawDrawing::reference_id() const noexcept -> const ReferenceId&
{
    return reference_id_;
}

auto ExcalidrawDrawing::caption() const noexcept -> std::string_view
{
    return caption_;
}

auto ExcalidrawDrawing::width() const noexcept -> DrawingWidth
{
    return width_;
}
}  // namespace dans::document::plugins
