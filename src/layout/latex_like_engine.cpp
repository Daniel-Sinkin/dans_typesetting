// src/layout/latex_like_engine.cpp — implement a constrained TeX-style paragraph and page builder.
#include "layout/latex_like_engine.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <limits>
#include <memory>
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
using dans::document::layout::GlyphPlacement;
using dans::document::layout::GlyphRun;
using dans::document::layout::GlyphRunRole;
using dans::document::layout::LatexLikeStyle;
using dans::document::layout::LayoutPoint;
using dans::document::layout::Page;
using dans::document::layout::PagedDocument;
using dans::document::layout::ScaledPoint;

constexpr auto k_tex_points_per_inch = 72.27;
constexpr auto k_millimeters_per_inch = 25.4;
constexpr auto k_font_units_per_em = 1000.0;
constexpr auto k_line_penalty = 10.0;

struct SpaceMetrics
{
    double natural{};
    double stretch{};
    double shrink{};
};

struct Word
{
    std::string text{};
    double width{};
};

struct ParagraphInput
{
    std::vector<Word> words{};
    std::vector<SpaceMetrics> spaces{};
};

struct LineRange
{
    usize first_word{};
    usize word_count{};
};

[[nodiscard]] auto to_u8(const char character) -> u8
{
    return static_cast<u8>(character);
}

[[nodiscard]] auto normalized_ascii_text(const std::string_view source) -> std::string
{
    std::string result;
    result.reserve(source.size());
    auto pending_space = false;
    for (const char character : source)
    {
        const auto byte = static_cast<unsigned char>(character);
        if (std::isspace(byte) != 0)
        {
            pending_space = !result.empty();
            continue;
        }
        if (byte < 32U || byte > 126U)
        {
            throw std::invalid_argument{
                "The initial LaTeX-like paragraph layout supports printable ASCII only"
            };
        }
        if (pending_space)
        {
            result.push_back(' ');
            pending_space = false;
        }
        result.push_back(character);
    }
    return result;
}

[[nodiscard]] auto word_width(const std::string_view word, const Type1Font& font) -> double
{
    auto result = 0.0;
    auto previous = u8{};
    auto has_previous = false;
    for (const char character : word)
    {
        const auto code = to_u8(character);
        if (has_previous)
        {
            result += font.kerning(previous, code);
        }
        result += font.glyph_width(code);
        previous = code;
        has_previous = true;
    }
    return result;
}

[[nodiscard]] auto sentence_space_factor(const std::string_view preceding_word) -> double
{
    if (preceding_word.empty())
    {
        return 1.0;
    }
    switch (preceding_word.back())
    {
        case ',':
            return 1.25;
        case ';':
            return 1.5;
        case ':':
            return 2.0;
        case '.':
        case '!':
        case '?':
            return 3.0;
        default:
            return 1.0;
    }
}

[[nodiscard]] auto space_after(const std::string_view word, const Type1Font& font) -> SpaceMetrics
{
    const auto factor = sentence_space_factor(word);
    return SpaceMetrics{
        .natural =
            font.glyph_width(to_u8(' ')) + (factor >= 2.0 ? font.extra_sentence_space() : 0.0),
        .stretch = font.space_stretch() * factor,
        .shrink = font.space_shrink() / factor,
    };
}

[[nodiscard]] auto parse_paragraph(const std::string_view source, const Type1Font& font)
    -> ParagraphInput
{
    const auto text = normalized_ascii_text(source);
    ParagraphInput result;
    auto offset = usize{};
    while (offset < text.size())
    {
        const auto end = text.find(' ', offset);
        const auto word_end = end == std::string::npos ? text.size() : end;
        const auto word = std::string_view{text}.substr(offset, word_end - offset);
        result.words.push_back(Word{.text = std::string{word}, .width = word_width(word, font)});
        if (end == std::string::npos)
        {
            break;
        }
        result.spaces.push_back(space_after(word, font));
        offset = end + 1U;
    }
    return result;
}

struct LineMetrics
{
    double natural{};
    double stretch{};
    double shrink{};
};

[[nodiscard]] auto
measure_line(const ParagraphInput& paragraph, const usize first_word, const usize last_word)
    -> LineMetrics
{
    LineMetrics result;
    for (auto index = first_word; index <= last_word; ++index)
    {
        result.natural += paragraph.words[index].width;
        if (index < last_word)
        {
            result.natural += paragraph.spaces[index].natural;
            result.stretch += paragraph.spaces[index].stretch;
            result.shrink += paragraph.spaces[index].shrink;
        }
    }
    return result;
}

[[nodiscard]] auto line_demerits(
    const LineMetrics& metrics,
    const double target_width,
    const bool is_last_line,
    const bool contains_one_word
) -> double
{
    const auto difference = target_width - metrics.natural;
    if (is_last_line && difference >= 0.0)
    {
        return k_line_penalty * k_line_penalty;
    }

    double ratio{};
    if (difference >= 0.0)
    {
        if (metrics.stretch <= 0.0)
        {
            return contains_one_word ? 1.0e12 + difference * difference
                                     : std::numeric_limits<double>::infinity();
        }
        ratio = difference / metrics.stretch;
    }
    else
    {
        if (metrics.shrink <= 0.0 || difference < -metrics.shrink)
        {
            return contains_one_word ? 1.0e12 + difference * difference
                                     : std::numeric_limits<double>::infinity();
        }
        ratio = difference / metrics.shrink;
    }
    const auto badness = std::min(10'000.0, 100.0 * std::pow(std::abs(ratio), 3.0));
    return std::pow(k_line_penalty + badness, 2.0);
}

[[nodiscard]] auto break_paragraph(
    const ParagraphInput& paragraph, const double first_line_width, const double ordinary_line_width
) -> std::vector<LineRange>
{
    const auto count = paragraph.words.size();
    if (count == 0U)
    {
        return {};
    }

    const auto infinity = std::numeric_limits<double>::infinity();
    std::vector<double> normal_cost(count + 1U, infinity);
    std::vector<usize> normal_next(count + 1U, count);
    normal_cost[count] = 0.0;
    for (auto first = count; first-- > 0U;)
    {
        for (auto last = first; last < count; ++last)
        {
            const auto metrics = measure_line(paragraph, first, last);
            const auto cost =
                line_demerits(metrics, ordinary_line_width, last + 1U == count, first == last);
            if (!std::isfinite(cost) || !std::isfinite(normal_cost[last + 1U]))
            {
                continue;
            }
            const auto candidate = cost + normal_cost[last + 1U];
            if (candidate < normal_cost[first])
            {
                normal_cost[first] = candidate;
                normal_next[first] = last + 1U;
            }
        }
    }

    auto first_break = count;
    auto first_cost = infinity;
    for (auto last = usize{}; last < count; ++last)
    {
        const auto metrics = measure_line(paragraph, 0U, last);
        const auto cost = line_demerits(metrics, first_line_width, last + 1U == count, last == 0U);
        if (!std::isfinite(cost) || !std::isfinite(normal_cost[last + 1U]))
        {
            continue;
        }
        const auto candidate = cost + normal_cost[last + 1U];
        if (candidate < first_cost)
        {
            first_cost = candidate;
            first_break = last + 1U;
        }
    }
    if (!std::isfinite(first_cost) || first_break == 0U)
    {
        throw std::runtime_error{"The LaTeX-like line breaker could not place a paragraph"};
    }

    std::vector<LineRange> lines;
    lines.push_back(LineRange{.first_word = 0U, .word_count = first_break});
    auto first = first_break;
    while (first < count)
    {
        const auto next = normal_next[first];
        if (next <= first || next > count)
        {
            throw std::logic_error{"The LaTeX-like line-break solution is incomplete"};
        }
        lines.push_back(LineRange{.first_word = first, .word_count = next - first});
        first = next;
    }
    return lines;
}

[[nodiscard]] auto scaled_font_units(const double units, const ScaledPoint font_size) -> ScaledPoint
{
    return ScaledPoint::from_tex_points(units * font_size.tex_points() / k_font_units_per_em);
}

[[nodiscard]] auto make_line_run(
    const ParagraphInput& paragraph,
    const LineRange line,
    const bool first_line,
    const bool last_line,
    const double target_width,
    const Type1Font& font,
    const LatexLikeStyle& style,
    const ScaledPoint baseline_y
) -> GlyphRun
{
    const auto last_word = line.first_word + line.word_count - 1U;
    const auto metrics = measure_line(paragraph, line.first_word, last_word);
    auto glue_ratio = 0.0;
    if (!last_line)
    {
        const auto difference = target_width - metrics.natural;
        if (difference >= 0.0 && metrics.stretch > 0.0)
        {
            glue_ratio = difference / metrics.stretch;
        }
        else if (difference < 0.0 && metrics.shrink > 0.0)
        {
            glue_ratio = difference / metrics.shrink;
        }
    }

    GlyphRun result{
        .font_key = "roman",
        .font_size = style.font_size,
        .baseline =
            LayoutPoint{
                .x = style.text_left + (first_line ? style.paragraph_indent : ScaledPoint{}),
                .y = baseline_y,
            },
        .role = GlyphRunRole::body,
        .glyphs = {},
    };
    auto x = ScaledPoint{};
    for (auto word_index = line.first_word; word_index <= last_word; ++word_index)
    {
        const auto& word = paragraph.words[word_index].text;
        auto previous = u8{};
        auto has_previous = false;
        for (const char character : word)
        {
            const auto code = to_u8(character);
            if (has_previous)
            {
                x += scaled_font_units(font.kerning(previous, code), style.font_size);
            }
            const auto advance = scaled_font_units(font.glyph_width(code), style.font_size);
            result.glyphs.push_back(
                GlyphPlacement{
                    .character_code = code,
                    .unicode = static_cast<char32_t>(code),
                    .x_offset = x,
                    .advance = advance,
                }
            );
            x += advance;
            previous = code;
            has_previous = true;
        }
        if (word_index < last_word)
        {
            const auto& space = paragraph.spaces[word_index];
            auto advance_units = space.natural;
            if (glue_ratio >= 0.0)
            {
                advance_units += glue_ratio * space.stretch;
            }
            else
            {
                advance_units += glue_ratio * space.shrink;
            }
            const auto advance = scaled_font_units(advance_units, style.font_size);
            result.glyphs.push_back(
                GlyphPlacement{
                    .character_code = to_u8(' '),
                    .unicode = U' ',
                    .x_offset = x,
                    .advance = advance,
                }
            );
            x += advance;
        }
    }
    return result;
}

[[nodiscard]] auto
make_page_number_run(const usize page_number, const Type1Font& font, const LatexLikeStyle& style)
    -> GlyphRun
{
    const auto text = std::to_string(page_number);
    const auto width = scaled_font_units(word_width(text, font), style.font_size);
    GlyphRun result{
        .font_key = "roman",
        .font_size = style.font_size,
        .baseline =
            LayoutPoint{
                .x = style.text_left
                     + ScaledPoint::from_raw((style.text_width.raw() - width.raw()) / 2),
                .y = style.footer_baseline_y,
            },
        .role = GlyphRunRole::page_number,
        .glyphs = {},
    };
    auto x = ScaledPoint{};
    auto previous = u8{};
    auto has_previous = false;
    for (const char character : text)
    {
        const auto code = to_u8(character);
        if (has_previous)
        {
            x += scaled_font_units(font.kerning(previous, code), style.font_size);
        }
        const auto advance = scaled_font_units(font.glyph_width(code), style.font_size);
        result.glyphs.push_back(
            GlyphPlacement{
                .character_code = code,
                .unicode = static_cast<char32_t>(code),
                .x_offset = x,
                .advance = advance,
            }
        );
        x += advance;
        previous = code;
        has_previous = true;
    }
    return result;
}

auto validate_style(const LatexLikeStyle& style) -> void
{
    if (style.page_size.width <= ScaledPoint{} || style.page_size.height <= ScaledPoint{}
        || style.text_width <= ScaledPoint{} || style.font_size <= ScaledPoint{}
        || style.baseline_skip <= ScaledPoint{} || style.paragraph_indent < ScaledPoint{}
        || style.first_baseline_y > style.page_size.height
        || style.last_baseline_y > style.first_baseline_y)
    {
        throw std::invalid_argument{"Invalid LaTeX-like page style"};
    }
}
}  // namespace

namespace dans::document::layout
{
class LatexLikeOutput::Impl final
{
  public:
    Impl(const fonts::Type1Font& font, const LatexLikeStyle& style) : font_{font}, style_{style}
    {
    }

    auto write_paragraph(const std::string_view source) -> void
    {
        const auto paragraph = parse_paragraph(source, font_);
        if (paragraph.words.empty())
        {
            return;
        }
        ensure_page();
        const auto font_size = style_.font_size.tex_points();
        const auto ordinary_width =
            style_.text_width.tex_points() / font_size * k_font_units_per_em;
        const auto first_width = (style_.text_width - style_.paragraph_indent).tex_points()
                                 / font_size * k_font_units_per_em;
        const auto lines = break_paragraph(paragraph, first_width, ordinary_width);
        for (usize index{}; index < lines.size(); ++index)
        {
            if (current_baseline_ < style_.last_baseline_y)
            {
                start_page();
            }
            const auto target = index == 0U ? first_width : ordinary_width;
            pages_.pages.back().glyph_runs.push_back(make_line_run(
                paragraph,
                lines[index],
                index == 0U,
                index + 1U == lines.size(),
                target,
                font_,
                style_,
                current_baseline_
            ));
            current_baseline_ -= style_.baseline_skip;
        }
    }

    [[nodiscard]] auto finish() -> PagedDocument
    {
        ensure_page();
        for (usize index{}; index < pages_.pages.size(); ++index)
        {
            auto& page = pages_.pages[index];
            page.glyph_runs.push_back(make_page_number_run(index + 1U, font_, style_));
        }
        return std::move(pages_);
    }

  private:
    auto ensure_page() -> void
    {
        if (pages_.pages.empty())
        {
            start_page();
        }
    }

    auto start_page() -> void
    {
        pages_.pages.push_back(Page{.size = style_.page_size, .glyph_runs = {}});
        current_baseline_ = style_.first_baseline_y;
    }

    const fonts::Type1Font& font_;
    const LatexLikeStyle& style_;
    PagedDocument pages_{};
    ScaledPoint current_baseline_{};
};

auto LatexLikeStyle::article_11pt_a4() -> LatexLikeStyle
{
    const auto page_width = 210.0 / k_millimeters_per_inch * k_tex_points_per_inch;
    const auto page_height = 297.0 / k_millimeters_per_inch * k_tex_points_per_inch;
    constexpr auto text_width = 360.0;
    constexpr auto font_size = 10.95;
    constexpr auto baseline_skip = 13.6;
    constexpr auto top_skip = 11.0;
    constexpr auto head_height = 12.0;
    constexpr auto head_separation = 25.0;
    constexpr auto footer_separation = 30.0;
    constexpr auto paragraph_indent = 17.0;
    constexpr auto text_baseline_count = 43.0;
    constexpr auto text_height = text_baseline_count * baseline_skip + top_skip;
    const auto top_margin = std::trunc(
        (page_height - 2.0 * k_tex_points_per_inch - head_height - head_separation - text_height
         - footer_separation)
        / 2.0
    );
    const auto side_margin = std::trunc((page_width - text_width) / 2.0 - k_tex_points_per_inch);
    const auto text_top = k_tex_points_per_inch + top_margin + head_height + head_separation;
    const auto first_baseline = page_height - text_top - top_skip;
    const auto last_baseline = first_baseline - text_baseline_count * baseline_skip;
    return LatexLikeStyle{
        .page_size =
            PageSize{
                .width = ScaledPoint::from_tex_points(page_width),
                .height = ScaledPoint::from_tex_points(page_height),
            },
        .text_left = ScaledPoint::from_tex_points(k_tex_points_per_inch + side_margin),
        .text_width = ScaledPoint::from_tex_points(text_width),
        .first_baseline_y = ScaledPoint::from_tex_points(first_baseline),
        .last_baseline_y = ScaledPoint::from_tex_points(last_baseline),
        .footer_baseline_y = ScaledPoint::from_tex_points(last_baseline - footer_separation),
        .paragraph_indent = ScaledPoint::from_tex_points(paragraph_indent),
        .baseline_skip = ScaledPoint::from_tex_points(baseline_skip),
        .font_size = ScaledPoint::from_tex_points(font_size),
    };
}

LatexLikeOutput::LatexLikeOutput(Impl& implementation) noexcept : implementation_{implementation}
{
}

auto LatexLikeOutput::write_paragraph(const std::string_view text) -> void
{
    implementation_.write_paragraph(text);
}

LatexLikeEngine::LatexLikeEngine(
    std::shared_ptr<const fonts::Type1Font> roman_font, LatexLikeStyle style
)
    : roman_font_{std::move(roman_font)}, style_{style}
{
    if (roman_font_ == nullptr)
    {
        throw std::invalid_argument{"A LaTeX-like layout engine requires a Roman font"};
    }
    validate_style(style_);
}

auto LatexLikeEngine::register_block_adapter(std::unique_ptr<LatexLikeBlockAdapter> adapter) -> void
{
    if (adapter == nullptr)
    {
        throw std::invalid_argument{"Cannot register a null LaTeX-like block adapter"};
    }
    if (adapter->block_type_id().empty())
    {
        throw std::invalid_argument{"A LaTeX-like block adapter requires a type ID"};
    }
    if (supports_block(adapter->block_type_id()))
    {
        throw std::invalid_argument{
            "A LaTeX-like adapter is already registered for block type '"
            + std::string{adapter->block_type_id()} + "'"
        };
    }
    block_adapters_.push_back(std::move(adapter));
}

auto LatexLikeEngine::supports_block(const std::string_view block_type_id) const noexcept -> bool
{
    return block_adapter_for(block_type_id) != nullptr;
}

auto LatexLikeEngine::layout(const Document& document) const -> PagedDocument
{
    validate(document);
    LatexLikeOutput::Impl implementation{*roman_font_, style_};
    LatexLikeOutput output{implementation};
    for (const auto& block : document.blocks().blocks())
    {
        const auto* adapter = block_adapter_for(block->type_id());
        if (adapter == nullptr)
        {
            throw std::logic_error{"LaTeX-like adapter disappeared after validation"};
        }
        adapter->layout(*block, output);
    }
    return implementation.finish();
}

auto LatexLikeEngine::style() const noexcept -> const LatexLikeStyle&
{
    return style_;
}

auto LatexLikeEngine::roman_font() const noexcept -> const fonts::Type1Font&
{
    return *roman_font_;
}

auto LatexLikeEngine::block_adapter_for(const std::string_view block_type_id) const noexcept
    -> const LatexLikeBlockAdapter*
{
    const auto match = std::ranges::find_if(
        block_adapters_,
        [block_type_id](const std::unique_ptr<LatexLikeBlockAdapter>& adapter)
        { return adapter->block_type_id() == block_type_id; }
    );
    return match == block_adapters_.end() ? nullptr : match->get();
}

auto LatexLikeEngine::validate(const Document& document) const -> void
{
    for (const auto& block : document.blocks().blocks())
    {
        if (!supports_block(block->type_id()))
        {
            throw std::runtime_error{
                "No LaTeX-like layout adapter is registered for block type '"
                + std::string{block->type_id()} + "'"
            };
        }
    }
}
}  // namespace dans::document::layout
