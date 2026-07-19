// Lower one writer-resolved Python plot without caption or numbering knowledge.
#include "connectors/markdown/python_plot.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::connectors::markdown
{
PythonPlotMarkdownAdapter::PythonPlotMarkdownAdapter(PythonPlotAssetResolver asset_resolver)
    : asset_resolver_{std::move(asset_resolver)}
{
    if (!asset_resolver_)
    {
        throw std::invalid_argument{"A Python plot Markdown adapter requires an asset resolver"};
    }
}

auto PythonPlotMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::PythonPlot::k_type_id;
}

auto PythonPlotMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
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
    output.write_raw("![](");
    output.write_raw(writers::markdown_link_destination(asset_path.generic_string()));
    output.write_raw(")\n\n");
}
}  // namespace dans::document::connectors::markdown
