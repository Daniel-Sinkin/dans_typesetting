// src/writers/latex_like_pdf_writer.hpp — lower LaTeX-like page layouts into selectable PDF.
#ifndef DANS_TYPESETTING_SRC_WRITERS_LATEX_LIKE_PDF_WRITER_HPP
#define DANS_TYPESETTING_SRC_WRITERS_LATEX_LIKE_PDF_WRITER_HPP

#include "fonts/type1_font.hpp"
#include "layout/latex_like_engine.hpp"
#include "layout/page_layout.hpp"

#include <filesystem>
#include <iosfwd>
#include <memory>

namespace dans::document::writers
{
class PdfSerializer final
{
  public:
    explicit PdfSerializer(std::shared_ptr<const fonts::Type1Font> roman_font);

    auto serialize(const layout::PagedDocument& document, std::ostream& output) const -> void;
    auto write_file(
        const layout::PagedDocument& document, const std::filesystem::path& output_path
    ) const -> void;

  private:
    std::shared_ptr<const fonts::Type1Font> roman_font_{};
};

class LatexLikePdfWriter final
{
  public:
    explicit LatexLikePdfWriter(
        std::shared_ptr<const fonts::Type1Font> roman_font,
        layout::LatexLikeStyle style = layout::LatexLikeStyle::article_11pt_a4()
    );

    auto register_block_adapter(std::unique_ptr<layout::LatexLikeBlockAdapter> adapter) -> void;
    [[nodiscard]] auto layout(const Document& document) const -> layout::PagedDocument;
    auto write_file(const Document& document, const std::filesystem::path& output_path) const
        -> void;

  private:
    layout::LatexLikeEngine layout_engine_;
    PdfSerializer serializer_;
};
}  // namespace dans::document::writers

#endif  // DANS_TYPESETTING_SRC_WRITERS_LATEX_LIKE_PDF_WRITER_HPP
