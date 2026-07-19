// src/writers/latex_like_pdf_writer.cpp — write PDF objects, fonts, pages, and text streams.
#include "writers/latex_like_pdf_writer.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <limits>
#include <optional>
#include <ostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace
{
using dans::u8;
using dans::usize;
using dans::document::fonts::Type1Font;
using dans::document::layout::GlyphRun;
using dans::document::layout::Page;
using dans::document::layout::PagedDocument;
using dans::document::layout::ScaledPoint;

constexpr auto k_pdf_points_per_inch = 72.0;
constexpr auto k_tex_points_per_inch = 72.27;

[[nodiscard]] auto pdf_points(const ScaledPoint value) -> double
{
    return value.tex_points() * k_pdf_points_per_inch / k_tex_points_per_inch;
}

[[nodiscard]] auto pdf_number(const double value) -> std::string
{
    if (!std::isfinite(value))
    {
        throw std::invalid_argument{"A PDF number must be finite"};
    }
    std::ostringstream output;
    output << std::fixed << std::setprecision(5) << value;
    auto result = output.str();
    while (result.contains('.') && result.ends_with('0'))
    {
        result.pop_back();
    }
    if (result.ends_with('.'))
    {
        result.pop_back();
    }
    if (result == "-0")
    {
        return "0";
    }
    return result;
}

[[nodiscard]] auto hex_byte(const u8 value) -> std::string
{
    constexpr std::array<char, 16> digits{
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
    };
    std::string result(2U, '0');
    result[0] = digits[static_cast<usize>(value >> 4U)];
    result[1] = digits[static_cast<usize>(value & 0x0fU)];
    return result;
}

[[nodiscard]] auto hex_unicode(const char32_t value) -> std::string
{
    if (value > 0xffffU)
    {
        throw std::invalid_argument{"The initial PDF writer supports basic-plane Unicode only"};
    }
    std::ostringstream output;
    output << std::uppercase << std::hex << std::setw(4) << std::setfill('0')
           << static_cast<std::uint32_t>(value);
    return output.str();
}

[[nodiscard]] auto make_stream(const std::string_view dictionary, const std::string_view contents)
    -> std::string
{
    std::string result{"<< "};
    result.append(dictionary);
    if (!dictionary.empty())
    {
        result.push_back(' ');
    }
    result.append("/Length ");
    result.append(std::to_string(contents.size()));
    result.append(" >>\nstream\n");
    result.append(contents);
    result.append("\nendstream");
    return result;
}

class PdfObjects final
{
  public:
    [[nodiscard]] auto reserve() -> usize
    {
        objects_.emplace_back(std::nullopt);
        return objects_.size();
    }

    [[nodiscard]] auto add(std::string object) -> usize
    {
        const auto identifier = reserve();
        set(identifier, std::move(object));
        return identifier;
    }

    auto set(const usize identifier, std::string object) -> void
    {
        if (identifier == 0U || identifier > objects_.size())
        {
            throw std::out_of_range{"Invalid PDF object identifier"};
        }
        auto& destination = objects_[identifier - 1U];
        if (destination.has_value())
        {
            throw std::logic_error{"A PDF object cannot be assigned twice"};
        }
        destination = std::move(object);
    }

    [[nodiscard]] auto render(const usize root_identifier) const -> std::string
    {
        if (root_identifier == 0U || root_identifier > objects_.size())
        {
            throw std::out_of_range{"Invalid PDF catalog identifier"};
        }
        std::string output{"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"};
        std::vector<usize> offsets(objects_.size() + 1U, 0U);
        for (usize index{}; index < objects_.size(); ++index)
        {
            const auto& object = objects_[index];
            if (!object.has_value())
            {
                throw std::logic_error{"A reserved PDF object was not assigned"};
            }
            offsets[index + 1U] = output.size();
            output.append(std::to_string(index + 1U));
            output.append(" 0 obj\n");
            output.append(*object);
            output.append("\nendobj\n");
        }

        const auto cross_reference_offset = output.size();
        std::ostringstream cross_reference;
        cross_reference << "xref\n0 " << objects_.size() + 1U << "\n0000000000 65535 f \n";
        for (usize index = 1U; index < offsets.size(); ++index)
        {
            if (offsets[index] > 9'999'999'999ULL)
            {
                throw std::length_error{"PDF output exceeds classic cross-reference limits"};
            }
            cross_reference << std::setw(10) << std::setfill('0') << offsets[index]
                            << " 00000 n \n";
        }
        cross_reference << "trailer\n<< /Size " << objects_.size() + 1U << " /Root "
                        << root_identifier << " 0 R >>\nstartxref\n"
                        << cross_reference_offset << "\n%%EOF\n";
        output.append(cross_reference.str());
        return output;
    }

  private:
    std::vector<std::optional<std::string>> objects_{};
};

[[nodiscard]] auto font_program_stream(const Type1Font& font) -> std::string
{
    std::string dictionary{"/Length1 "};
    dictionary.append(std::to_string(font.clear_text_length()));
    dictionary.append(" /Length2 ");
    dictionary.append(std::to_string(font.encrypted_length()));
    dictionary.append(" /Length3 ");
    dictionary.append(std::to_string(font.fixed_content_length()));
    return make_stream(dictionary, font.program());
}

[[nodiscard]] auto to_unicode_stream() -> std::string
{
    std::string cmap{"/CIDInit /ProcSet findresource begin\n"
                     "12 dict begin\n"
                     "begincmap\n"
                     "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n"
                     "/CMapName /DansAscii def\n"
                     "/CMapType 2 def\n"
                     "1 begincodespacerange\n"
                     "<00> <FF>\n"
                     "endcodespacerange\n"
                     "95 beginbfchar\n"};
    for (auto code = usize{32}; code <= usize{126}; ++code)
    {
        cmap.push_back('<');
        cmap.append(hex_byte(static_cast<u8>(code)));
        cmap.append("> <");
        cmap.append(hex_unicode(static_cast<char32_t>(code)));
        cmap.append(">\n");
    }
    cmap.append(
        "endbfchar\n"
        "endcmap\n"
        "CMapName currentdict /CMap defineresource pop\n"
        "end\n"
        "end\n"
    );
    return make_stream({}, cmap);
}

[[nodiscard]] auto font_descriptor(const Type1Font& font, const usize font_file_identifier)
    -> std::string
{
    const auto& box = font.bounding_box();
    std::string result{"<< /Type /FontDescriptor /FontName /"};
    result.append(font.postscript_name());
    result.append(" /Flags 34 /FontBBox [");
    result.append(pdf_number(box.left));
    result.push_back(' ');
    result.append(pdf_number(box.bottom));
    result.push_back(' ');
    result.append(pdf_number(box.right));
    result.push_back(' ');
    result.append(pdf_number(box.top));
    result.append("] /Ascent ");
    result.append(pdf_number(font.ascent()));
    result.append(" /Descent ");
    result.append(pdf_number(font.descent()));
    result.append(" /CapHeight ");
    result.append(pdf_number(font.cap_height()));
    result.append(" /XHeight ");
    result.append(pdf_number(font.x_height()));
    result.append(" /ItalicAngle 0 /StemV 80 /FontFile ");
    result.append(std::to_string(font_file_identifier));
    result.append(" 0 R >>");
    return result;
}

[[nodiscard]] auto font_dictionary(
    const Type1Font& font, const usize descriptor_identifier, const usize to_unicode_identifier
) -> std::string
{
    std::string result{"<< /Type /Font /Subtype /Type1 /BaseFont /"};
    result.append(font.postscript_name());
    result.append(" /FirstChar 32 /LastChar 126 /Widths [");
    for (auto code = usize{32}; code <= usize{126}; ++code)
    {
        if (code != 32U)
        {
            result.push_back(' ');
        }
        result.append(pdf_number(font.glyph_width(static_cast<u8>(code))));
    }
    result.append("] /FontDescriptor ");
    result.append(std::to_string(descriptor_identifier));
    result.append(" 0 R /Encoding /WinAnsiEncoding /ToUnicode ");
    result.append(std::to_string(to_unicode_identifier));
    result.append(" 0 R >>");
    return result;
}

auto append_glyph_run(std::string& content, const GlyphRun& run, const Type1Font& font) -> void
{
    if (run.font_key != "roman" || run.glyphs.empty())
    {
        if (run.glyphs.empty())
        {
            return;
        }
        throw std::invalid_argument{"The PDF writer received an unknown layout font"};
    }
    content.append("BT\n/F1 ");
    content.append(pdf_number(pdf_points(run.font_size)));
    content.append(" Tf\n1 0 0 1 ");
    content.append(pdf_number(pdf_points(run.baseline.x)));
    content.push_back(' ');
    content.append(pdf_number(pdf_points(run.baseline.y)));
    content.append(" Tm\n[");

    std::string encoded;
    const auto flush_encoded = [&content, &encoded]
    {
        if (!encoded.empty())
        {
            content.push_back('<');
            content.append(encoded);
            content.push_back('>');
            encoded.clear();
        }
    };
    for (usize index{}; index < run.glyphs.size(); ++index)
    {
        const auto& glyph = run.glyphs[index];
        if (glyph.unicode != static_cast<char32_t>(glyph.character_code))
        {
            throw std::invalid_argument{"The initial PDF font mapping supports ASCII glyphs only"};
        }
        encoded.append(hex_byte(glyph.character_code));
        if (index + 1U == run.glyphs.size())
        {
            continue;
        }

        const auto natural_advance =
            font.glyph_width(glyph.character_code) * run.font_size.tex_points() / 1000.0;
        const auto desired_advance =
            (run.glyphs[index + 1U].x_offset - glyph.x_offset).tex_points();
        const auto adjustment =
            (natural_advance - desired_advance) * 1000.0 / run.font_size.tex_points();
        if (std::abs(adjustment) > 0.0005)
        {
            flush_encoded();
            content.push_back(' ');
            content.append(pdf_number(adjustment));
            content.push_back(' ');
        }
    }
    flush_encoded();
    content.append("] TJ\nET\n");
}

[[nodiscard]] auto page_content(const Page& page, const Type1Font& font) -> std::string
{
    std::string result{"0 g 0 G\n"};
    for (const auto& run : page.glyph_runs)
    {
        append_glyph_run(result, run, font);
    }
    return result;
}

[[nodiscard]] auto render_pdf(const PagedDocument& document, const Type1Font& font) -> std::string
{
    if (document.pages.empty())
    {
        throw std::invalid_argument{"A PDF document requires at least one page"};
    }

    PdfObjects objects;
    const auto catalog_identifier = objects.reserve();
    const auto pages_identifier = objects.reserve();
    const auto font_file_identifier = objects.add(font_program_stream(font));
    const auto descriptor_identifier = objects.add(font_descriptor(font, font_file_identifier));
    const auto to_unicode_identifier = objects.add(to_unicode_stream());
    const auto font_identifier =
        objects.add(font_dictionary(font, descriptor_identifier, to_unicode_identifier));

    std::vector<usize> page_identifiers;
    page_identifiers.reserve(document.pages.size());
    for (const auto& page : document.pages)
    {
        const auto content_identifier = objects.add(make_stream({}, page_content(page, font)));
        const auto page_identifier = objects.reserve();
        page_identifiers.push_back(page_identifier);
        std::string page_dictionary{"<< /Type /Page /Parent "};
        page_dictionary.append(std::to_string(pages_identifier));
        page_dictionary.append(" 0 R /MediaBox [0 0 ");
        page_dictionary.append(pdf_number(pdf_points(page.size.width)));
        page_dictionary.push_back(' ');
        page_dictionary.append(pdf_number(pdf_points(page.size.height)));
        page_dictionary.append("] /Resources << /Font << /F1 ");
        page_dictionary.append(std::to_string(font_identifier));
        page_dictionary.append(" 0 R >> /ProcSet [/PDF /Text] >> /Contents ");
        page_dictionary.append(std::to_string(content_identifier));
        page_dictionary.append(" 0 R >>");
        objects.set(page_identifier, std::move(page_dictionary));
    }

    std::string pages_dictionary{"<< /Type /Pages /Count "};
    pages_dictionary.append(std::to_string(page_identifiers.size()));
    pages_dictionary.append(" /Kids [");
    for (const auto identifier : page_identifiers)
    {
        pages_dictionary.append(std::to_string(identifier));
        pages_dictionary.append(" 0 R ");
    }
    pages_dictionary.append("] >>");
    objects.set(pages_identifier, std::move(pages_dictionary));
    objects.set(
        catalog_identifier,
        "<< /Type /Catalog /Pages " + std::to_string(pages_identifier) + " 0 R >>"
    );
    return objects.render(catalog_identifier);
}
}  // namespace

namespace dans::document::writers
{
PdfSerializer::PdfSerializer(std::shared_ptr<const fonts::Type1Font> roman_font)
    : roman_font_{std::move(roman_font)}
{
    if (roman_font_ == nullptr)
    {
        throw std::invalid_argument{"A PDF serializer requires a Roman font"};
    }
}

auto PdfSerializer::serialize(const layout::PagedDocument& document, std::ostream& output) const
    -> void
{
    const auto source = render_pdf(document, *roman_font_);
    output.write(source.data(), static_cast<std::streamsize>(source.size()));
    if (!output)
    {
        throw std::runtime_error{"Could not serialize the page layout as PDF"};
    }
}

auto PdfSerializer::write_file(
    const layout::PagedDocument& document, const std::filesystem::path& output_path
) const -> void
{
    std::ofstream output{output_path, std::ios::binary | std::ios::trunc};
    if (!output)
    {
        throw std::runtime_error{"Could not open PDF output: " + output_path.string()};
    }
    serialize(document, output);
}

LatexLikePdfWriter::LatexLikePdfWriter(
    std::shared_ptr<const fonts::Type1Font> roman_font, layout::LatexLikeStyle style
)
    : layout_engine_{roman_font, style}, serializer_{std::move(roman_font)}
{
}

auto LatexLikePdfWriter::register_block_adapter(
    std::unique_ptr<layout::LatexLikeBlockAdapter> adapter
) -> void
{
    layout_engine_.register_block_adapter(std::move(adapter));
}

auto LatexLikePdfWriter::layout(const Document& document) const -> layout::PagedDocument
{
    return layout_engine_.layout(document);
}

auto LatexLikePdfWriter::write_file(
    const Document& document, const std::filesystem::path& output_path
) const -> void
{
    serializer_.write_file(layout(document), output_path);
}
}  // namespace dans::document::writers
