// Lower a rendered Excalidraw asset to an ordinary numbered LaTeX figure.
#include "connectors/latex/excalidraw_drawing.hpp"

#include "connectors/latex/graphics.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::connectors::latex
{
ExcalidrawDrawingLatexAdapter::ExcalidrawDrawingLatexAdapter(ExcalidrawAssetResolver asset_resolver)
    : asset_resolver_{std::move(asset_resolver)}
{
    if (!asset_resolver_)
    {
        throw std::invalid_argument{"An Excalidraw LaTeX adapter requires an asset resolver"};
    }
}

auto ExcalidrawDrawingLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::ExcalidrawDrawing::k_type_id;
}

auto ExcalidrawDrawingLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    const auto* drawing = dynamic_cast<const plugins::ExcalidrawDrawing*>(&block);
    if (drawing == nullptr)
    {
        throw std::invalid_argument{
            "The Excalidraw drawing adapter received a different block type"
        };
    }

    const auto asset = asset_resolver_(*drawing);
    if (asset.empty())
    {
        throw std::runtime_error{"The Excalidraw asset resolver returned an empty path"};
    }
    output.write_raw("\\begin{figure}[htbp]\n\\centering\n\\includegraphics[width=");
    output.write_raw(detail::decimal(drawing->width().fraction()));
    output.write_raw("\\linewidth]{");
    output.write_raw(detail::graphics_path(asset));
    output.write_raw("}\n\\caption{");
    output.write_text(drawing->caption());
    output.write_raw("}\n\\label{");
    output.write_raw(drawing->reference_id().value());
    output.write_raw("}\n\\end{figure}\n\n");
}
}  // namespace dans::document::connectors::latex
