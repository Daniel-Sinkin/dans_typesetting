// src/writers/jupyter_writer.hpp — define a language-neutral Jupyter notebook writer.
#ifndef DANS_TYPESETTING_SRC_WRITERS_JUPYTER_WRITER_HPP
#define DANS_TYPESETTING_SRC_WRITERS_JUPYTER_WRITER_HPP

#include "document.hpp"
#include "writers/markdown_writer.hpp"

#include <filesystem>
#include <iosfwd>
#include <memory>
#include <string>

namespace dans::document::writers
{
// The first notebook policy is deliberately presentation-only. A configured
// authoritative Markdown writer lowers every semantic plugin, while this layer
// owns only nbformat structure and metadata. Mixed-language listings therefore
// remain honest presentation content instead of acquiring a false kernel.
class JupyterWriter final
{
  public:
    explicit JupyterWriter(std::shared_ptr<const MarkdownWriter> markdown_writer);

    auto serialize(const Document& document, std::ostream& output) const -> void;
    auto write_file(const Document& document, const std::filesystem::path& output_path) const
        -> void;

  private:
    [[nodiscard]] auto render(const Document& document) const -> std::string;

    std::shared_ptr<const MarkdownWriter> markdown_writer_{};
};
}  // namespace dans::document::writers

#endif  // DANS_TYPESETTING_SRC_WRITERS_JUPYTER_WRITER_HPP
