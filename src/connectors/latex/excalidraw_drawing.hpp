// Resolve semantic Excalidraw scenes to writer-owned assets for LaTeX.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_EXCALIDRAW_DRAWING_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_EXCALIDRAW_DRAWING_HPP

#include "plugins/excalidraw_drawing.hpp"
#include "writers/latex_writer.hpp"

#include <filesystem>
#include <functional>
#include <string_view>

namespace dans::document::connectors::latex
{
using ExcalidrawAssetResolver =
    std::function<std::filesystem::path(const plugins::ExcalidrawDrawing&)>;

class ExcalidrawDrawingLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    explicit ExcalidrawDrawingLatexAdapter(ExcalidrawAssetResolver asset_resolver);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;

  private:
    ExcalidrawAssetResolver asset_resolver_{};
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_EXCALIDRAW_DRAWING_HPP
