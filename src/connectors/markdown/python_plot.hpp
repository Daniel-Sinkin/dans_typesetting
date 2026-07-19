// Resolve Python plots to portable static image links in Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_PYTHON_PLOT_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_PYTHON_PLOT_HPP

#include "plugins/python_plot.hpp"
#include "writers/markdown_writer.hpp"

#include <filesystem>
#include <functional>
#include <string_view>

namespace dans::document::connectors::markdown
{
using PythonPlotAssetResolver =
    std::function<std::filesystem::path(const plugins::PythonPlot& plot)>;

class PythonPlotMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    explicit PythonPlotMarkdownAdapter(PythonPlotAssetResolver asset_resolver);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;

  private:
    PythonPlotAssetResolver asset_resolver_{};
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_PYTHON_PLOT_HPP
