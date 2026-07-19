// Semantic Excalidraw scene data; concrete rendering belongs to writer connectors.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_EXCALIDRAW_DRAWING_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_EXCALIDRAW_DRAWING_HPP

#include "document.hpp"
#include "reference_id.hpp"

#include <string>
#include <string_view>

namespace dans::document::plugins
{
class DrawingWidth final
{
  public:
    DrawingWidth() = default;

    [[nodiscard]] static auto from_fraction(f64 fraction) -> DrawingWidth;
    [[nodiscard]] static auto from_percent(f64 percent) -> DrawingWidth;
    [[nodiscard]] auto fraction() const noexcept -> f64;

  private:
    explicit DrawingWidth(f64 fraction, int) noexcept;

    f64 fraction_{1.0};
};

// The scene JSON is the authoritative plugin payload. It stays opaque to the
// document core and to writers; a connector-specific renderer resolves it to
// an output asset without adding that cache path to the semantic model.
class ExcalidrawDrawing final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.drawing.excalidraw";

    ExcalidrawDrawing(
        std::string_view scene_json,
        ReferenceId reference_id,
        std::string_view caption,
        DrawingWidth width = {}
    );

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto scene_json() const noexcept -> std::string_view;
    [[nodiscard]] auto reference_id() const noexcept -> const ReferenceId&;
    [[nodiscard]] auto caption() const noexcept -> std::string_view;
    [[nodiscard]] auto width() const noexcept -> DrawingWidth;

  private:
    std::string scene_json_{};
    ReferenceId reference_id_;
    std::string caption_{};
    DrawingWidth width_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_EXCALIDRAW_DRAWING_HPP
