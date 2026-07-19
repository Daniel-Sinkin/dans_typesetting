// Resolve trusted Python plots to writer-owned static graphics assets.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_PYTHON_PLOT_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_PYTHON_PLOT_HPP

#include "plugins/python_plot.hpp"
#include "writers/latex_writer.hpp"

#include <filesystem>
#include <functional>
#include <string_view>

namespace dans::document::connectors::latex
{
using PythonPlotAssetResolver =
    std::function<std::filesystem::path(const plugins::PythonPlot& plot)>;

class PythonPlotLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    explicit PythonPlotLatexAdapter(PythonPlotAssetResolver asset_resolver);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;

  private:
    PythonPlotAssetResolver asset_resolver_{};
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_PYTHON_PLOT_HPP
