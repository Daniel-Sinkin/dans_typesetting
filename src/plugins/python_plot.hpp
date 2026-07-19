// Trusted Python plot source and backend-neutral rendering intent.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_PYTHON_PLOT_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_PYTHON_PLOT_HPP

#include "document.hpp"
#include "plugins/media.hpp"

#include <string>
#include <string_view>

namespace dans::document::plugins
{
// Generated SVG/PDF/PNG files are deliberately absent from the semantic
// model. A writer-side adapter resolves this source to its own cached asset.
class PythonPlot final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.plot.python";
    static constexpr usize k_source_maximum_bytes = 100'000;
    static constexpr u32 k_extent_minimum = 64;
    static constexpr u32 k_extent_maximum = 4096;

    explicit PythonPlot(
        std::string source,
        RelativeWidth width = {},
        PixelExtent target_pixel_extent = PixelExtent{1280, 720}
    );

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto source() const noexcept -> std::string_view;
    [[nodiscard]] auto width() const noexcept -> RelativeWidth;
    [[nodiscard]] auto target_pixel_extent() const noexcept -> PixelExtent;

  private:
    std::string source_{};
    RelativeWidth width_{};
    PixelExtent target_pixel_extent_{1280, 720};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_PYTHON_PLOT_HPP
