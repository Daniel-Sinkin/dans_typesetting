// tests/native_latex_like_pdf_test.cpp — grow the native writer through staged paragraphs.
#include "connectors/latex_like/paragraph.hpp"
#include "document.hpp"
#include "fonts/type1_font.hpp"
#include "layout/latex_like_engine.hpp"
#include "layout/page_layout.hpp"
#include "plugins/paragraph.hpp"
#include "plugins/text.hpp"
#include "writers/latex_like_pdf_writer.hpp"

#include <cmath>
#include <exception>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <memory>
#include <print>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#ifndef DANS_TYPESETTING_LMR10_PFB
#    error "DANS_TYPESETTING_LMR10_PFB must identify the Latin Modern Type 1 font"
#endif

#ifndef DANS_TYPESETTING_LMR10_AFM
#    error "DANS_TYPESETTING_LMR10_AFM must identify the Latin Modern AFM metrics"
#endif

#ifndef DANS_TYPESETTING_LATEX_LIKE_PDF_OUTPUT
#    error "DANS_TYPESETTING_LATEX_LIKE_PDF_OUTPUT must identify a build-tree PDF"
#endif

namespace
{
using dans::usize;
using dans::document::Document;
using dans::document::layout::GlyphRun;
using dans::document::layout::GlyphRunRole;
using dans::document::layout::LatexLikeStyle;
using dans::document::layout::PagedDocument;
using dans::document::plugins::Paragraph;
using dans::document::writers::LatexLikePdfWriter;

constexpr auto k_four_sentences =
    "The quick brown fox jumped over the sleepy dog. A calm owl watched from the old oak tree. "
    "The dog stayed still, and the fox ran home. The quiet meadow became peaceful again.";

auto expect(const bool condition, const std::string_view message) -> void
{
    if (!condition)
    {
        throw std::runtime_error{std::string{message}};
    }
}

template <typename Function>
auto expect_rejected(Function&& function, const std::string_view context) -> void
{
    auto rejected = false;
    try
    {
        function();
    }
    catch (const std::exception&)
    {
        rejected = true;
    }
    expect(rejected, std::string{context} + " was unexpectedly accepted");
}

[[nodiscard]] auto body_runs(const PagedDocument& layout) -> std::vector<const GlyphRun*>
{
    std::vector<const GlyphRun*> result;
    for (const auto& page : layout.pages)
    {
        for (const auto& run : page.glyph_runs)
        {
            if (run.role == GlyphRunRole::body)
            {
                result.push_back(&run);
            }
        }
    }
    return result;
}

[[nodiscard]] auto run_text(const GlyphRun& run) -> std::string
{
    std::string result;
    result.reserve(run.glyphs.size());
    for (const auto& glyph : run.glyphs)
    {
        result.push_back(static_cast<char>(glyph.character_code));
    }
    return result;
}

[[nodiscard]] auto joined_text(const std::vector<const GlyphRun*>& runs) -> std::string
{
    std::string result;
    for (const auto* run : runs)
    {
        if (!result.empty())
        {
            result.push_back(' ');
        }
        result.append(run_text(*run));
    }
    return result;
}

[[nodiscard]] auto make_writer(const std::shared_ptr<const dans::document::fonts::Type1Font>& font)
    -> LatexLikePdfWriter
{
    auto inline_renderer =
        std::make_shared<dans::document::connectors::latex_like::InlineTextRenderer>();
    inline_renderer->register_inline_adapter(
        std::make_unique<dans::document::connectors::latex_like::TextAdapter>()
    );
    LatexLikePdfWriter writer{font};
    writer.register_block_adapter(
        std::make_unique<dans::document::connectors::latex_like::ParagraphAdapter>(inline_renderer)
    );
    return writer;
}

[[nodiscard]] auto one_paragraph(const std::string_view text) -> Document
{
    Document document;
    document.blocks().add<Paragraph>(text);
    return document;
}

auto verify_five_words(LatexLikePdfWriter& writer) -> void
{
    const auto layout = writer.layout(one_paragraph("the quick brown fox jumped"));
    const auto runs = body_runs(layout);
    expect(layout.pages.size() == 1U, "Five words unexpectedly created another page");
    expect(runs.size() == 1U, "Five words unexpectedly wrapped");
    expect(run_text(*runs[0]) == "the quick brown fox jumped", "Five-word text changed");
}

auto verify_punctuation(LatexLikePdfWriter& writer) -> void
{
    constexpr auto sentence = "The quick brown fox jumped, and the sleepy dog stayed.";
    const auto layout = writer.layout(one_paragraph(sentence));
    const auto runs = body_runs(layout);
    expect(runs.size() == 1U, "The first complete sentence unexpectedly wrapped");
    const auto rendered = run_text(*runs[0]);
    expect(
        rendered == sentence,
        "Comma or period changed during layout: expected '" + std::string{sentence}
            + "', received '" + rendered + "'"
    );
}

[[nodiscard]] auto verify_wrapping(LatexLikePdfWriter& writer) -> usize
{
    const auto layout = writer.layout(one_paragraph(k_four_sentences));
    const auto runs = body_runs(layout);
    expect(runs.size() > 1U, "Four sentences did not exercise line breaking");
    expect(joined_text(runs) == k_four_sentences, "Line breaking changed paragraph text");

    const auto style = LatexLikeStyle::article_11pt_a4();
    const auto right_edge = style.text_left + style.text_width;
    for (dans::usize index{}; index + 1U < runs.size(); ++index)
    {
        const auto& run = *runs[index];
        const auto& final_glyph = run.glyphs.back();
        const auto line_right = run.baseline.x + final_glyph.x_offset + final_glyph.advance;
        expect(
            std::abs((right_edge - line_right).tex_points()) < 0.02,
            "A non-final paragraph line was not justified to the text boundary"
        );
    }
    return runs.size();
}

auto verify_two_paragraphs(LatexLikePdfWriter& writer, const usize lines_per_paragraph) -> void
{
    Document document;
    document.blocks().add<Paragraph>(k_four_sentences);
    document.blocks().add<Paragraph>(k_four_sentences);
    const auto layout = writer.layout(document);
    const auto runs = body_runs(layout);
    expect(
        runs.size() == 2U * lines_per_paragraph,
        "Two paragraphs did not preserve both line sequences"
    );

    const auto style = LatexLikeStyle::article_11pt_a4();
    const auto first_line_x = style.text_left + style.paragraph_indent;
    expect(runs[0]->baseline.x == first_line_x, "The first paragraph lost its indentation");
    expect(
        runs[lines_per_paragraph]->baseline.x == first_line_x,
        "The second paragraph lost its indentation"
    );
    writer.write_file(document, DANS_TYPESETTING_LATEX_LIKE_PDF_OUTPUT);
}

auto verify_page_flow(LatexLikePdfWriter& writer, const usize lines_per_paragraph) -> void
{
    constexpr auto paragraph_count = usize{20};
    Document document;
    for (usize index{}; index < paragraph_count; ++index)
    {
        document.blocks().add<Paragraph>(k_four_sentences);
    }

    const auto layout = writer.layout(document);
    expect(layout.pages.size() > 1U, "Long paragraph flow did not create another page");
    expect(
        body_runs(layout).size() == paragraph_count * lines_per_paragraph,
        "Pagination lost body lines"
    );

    const auto style = LatexLikeStyle::article_11pt_a4();
    for (usize page_index{}; page_index < layout.pages.size(); ++page_index)
    {
        const auto& page = layout.pages[page_index];
        auto page_number_count = usize{};
        const GlyphRun* first_body_run{};
        for (const auto& run : page.glyph_runs)
        {
            if (run.role == GlyphRunRole::body)
            {
                if (first_body_run == nullptr)
                {
                    first_body_run = &run;
                }
                expect(
                    run.baseline.y <= style.first_baseline_y
                        && run.baseline.y >= style.last_baseline_y,
                    "A body baseline escaped the text area"
                );
                continue;
            }
            ++page_number_count;
            expect(run.role == GlyphRunRole::page_number, "A page contains an unknown run role");
            expect(run.baseline.y == style.footer_baseline_y, "A page number left the footer");
            expect(
                run_text(run) == std::to_string(page_index + 1U),
                "A page number does not match its page"
            );
        }
        expect(first_body_run != nullptr, "Pagination emitted an empty numbered page");
        expect(
            first_body_run->baseline.y == style.first_baseline_y,
            "A continued page did not restart on the first baseline"
        );
        expect(page_number_count == 1U, "A page does not contain exactly one page number");
    }
}

auto verify_initial_scope_rejections(LatexLikePdfWriter& writer) -> void
{
    expect_rejected(
        [&writer] { static_cast<void>(writer.layout(one_paragraph("caf\xc3\xa9"))); },
        "Non-ASCII paragraph text"
    );
    expect_rejected(
        [&writer]
        {
            Document document;
            auto& paragraph = document.blocks().add<Paragraph>();
            paragraph.inlines().add<dans::document::plugins::Text>(
                "styled", dans::document::plugins::TextStyle::bold
            );
            static_cast<void>(writer.layout(document));
        },
        "Styled native paragraph text"
    );
}

auto verify_pdf_structure() -> void
{
    std::ifstream input{DANS_TYPESETTING_LATEX_LIKE_PDF_OUTPUT, std::ios::binary};
    const std::string source{
        std::istreambuf_iterator<char>{input}, std::istreambuf_iterator<char>{}
    };
    expect(source.starts_with("%PDF-1.4"), "Native output lacks a PDF header");
    expect(source.contains("/Subtype /Type1"), "Native output lacks an embedded Type 1 font");
    expect(source.contains("/ToUnicode"), "Native output lacks selectable-text mapping");
    expect(source.contains("/Type /Page"), "Native output lacks a page object");
    expect(source.contains(" TJ"), "Native output lacks positioned text-showing operations");
    expect(source.ends_with("%%EOF\n"), "Native output lacks a complete PDF trailer");
}
}  // namespace

auto main() noexcept -> int
{
    try
    {
        auto font = std::make_shared<const dans::document::fonts::Type1Font>(
            DANS_TYPESETTING_LMR10_PFB, DANS_TYPESETTING_LMR10_AFM
        );
        expect(font->postscript_name() == "LMRoman10-Regular", "Unexpected Latin Modern font");
        auto writer = make_writer(font);
        verify_five_words(writer);
        verify_punctuation(writer);
        const auto lines_per_paragraph = verify_wrapping(writer);
        verify_two_paragraphs(writer, lines_per_paragraph);
        verify_page_flow(writer, lines_per_paragraph);
        verify_initial_scope_rejections(writer);
        verify_pdf_structure();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_latex_like_pdf_test failed: {}", error.what());
        }
        catch (...)
        {
            return 1;
        }
        return 1;
    }
    catch (...)
    {
        return 1;
    }
}
