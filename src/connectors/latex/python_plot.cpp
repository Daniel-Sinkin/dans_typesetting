// Lower one resolved Python plot asset without assuming caption semantics.
#include "connectors/latex/python_plot.hpp"

#include "connectors/latex/graphics.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::connectors::latex
{
PythonPlotLatexAdapter::PythonPlotLatexAdapter(PythonPlotAssetResolver asset_resolver)
    : asset_resolver_{std::move(asset_resolver)}
{
    if (!asset_resolver_)
    {
        throw std::invalid_argument{"A Python plot LaTeX adapter requires an asset resolver"};
    }
}

auto PythonPlotLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::PythonPlot::k_type_id;
}

auto PythonPlotLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    const auto* plot = dynamic_cast<const plugins::PythonPlot*>(&block);
    if (plot == nullptr)
    {
        throw std::invalid_argument{"The Python plot adapter received a different block type"};
    }
    const auto asset_path = asset_resolver_(*plot);
    if (asset_path.empty())
    {
        throw std::runtime_error{"The Python plot asset resolver returned an empty path"};
    }

    output.write_raw("\\begin{center}\n\\includegraphics[width=");
    output.write_raw(detail::decimal(plot->width().fraction()));
    output.write_raw("\\linewidth]{");
    output.write_raw(detail::graphics_path(asset_path));
    output.write_raw("}\n\\end{center}\n\n");
}
}  // namespace dans::document::connectors::latex
