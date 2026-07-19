// src/fonts/type1_font.cpp — parse the narrow AFM and PFB data needed by layout and PDF.
#include "fonts/type1_font.hpp"

#include <charconv>
#include <cstdint>
#include <fstream>
#include <iterator>
#include <limits>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <system_error>

namespace
{
using dans::u8;
using dans::usize;

[[nodiscard]] auto read_file(const std::filesystem::path& path) -> std::string
{
    std::ifstream input{path, std::ios::binary};
    if (!input)
    {
        throw std::runtime_error{"Could not open font resource: " + path.string()};
    }
    const std::string contents{
        std::istreambuf_iterator<char>{input}, std::istreambuf_iterator<char>{}
    };
    if (!input.eof() && input.fail())
    {
        throw std::runtime_error{"Could not read font resource: " + path.string()};
    }
    return contents;
}

[[nodiscard]] auto trim(const std::string_view value) -> std::string_view
{
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string_view::npos)
    {
        return {};
    }
    const auto last = value.find_last_not_of(" \t\r\n");
    return value.substr(first, last - first + 1U);
}

template <typename Number>
[[nodiscard]] auto parse_number(const std::string_view source, const std::string_view context)
    -> Number
{
    const auto value = trim(source);
    Number result{};
    const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), result);
    if (error != std::errc{} || end != value.data() + value.size())
    {
        throw std::invalid_argument{
            "Invalid numeric value in " + std::string{context} + ": " + std::string{value}
        };
    }
    return result;
}

[[nodiscard]] auto value_after_prefix(const std::string_view line, const std::string_view prefix)
    -> std::string_view
{
    return trim(line.substr(prefix.size()));
}

[[nodiscard]] auto value_after_colon(const std::string_view line) -> std::string_view
{
    const auto colon = line.find(':');
    if (colon == std::string_view::npos)
    {
        throw std::invalid_argument{"Malformed AFM TFM-comment field"};
    }
    const auto value = trim(line.substr(colon + 1U));
    const auto end = value.find_first_of(" \t");
    return value.substr(0, end);
}

struct ProgramSegments
{
    std::string bytes{};
    usize clear_text_length{};
    usize encrypted_length{};
    usize fixed_content_length{};
};

[[nodiscard]] auto little_endian_length(const std::string_view source, const usize offset) -> usize
{
    if (source.size() - offset < 4U)
    {
        throw std::invalid_argument{"Truncated PFB segment length"};
    }
    std::uint32_t value{};
    for (usize byte{}; byte < 4U; ++byte)
    {
        const auto part =
            static_cast<std::uint32_t>(static_cast<unsigned char>(source[offset + byte]));
        value |= part << static_cast<unsigned int>(8U * byte);
    }
    return static_cast<usize>(value);
}

[[nodiscard]] auto parse_pfb(const std::filesystem::path& path) -> ProgramSegments
{
    const auto source = read_file(path);
    ProgramSegments result;
    auto offset = usize{};
    auto encountered_binary = false;
    auto encountered_end = false;
    while (offset < source.size())
    {
        if (source.size() - offset < 2U || static_cast<unsigned char>(source[offset]) != 0x80U)
        {
            throw std::invalid_argument{"Malformed PFB segment marker in " + path.string()};
        }
        const auto segment_type = static_cast<u8>(source[offset + 1U]);
        offset += 2U;
        if (segment_type == 3U)
        {
            encountered_end = true;
            break;
        }
        if (segment_type != 1U && segment_type != 2U)
        {
            throw std::invalid_argument{"Unsupported PFB segment type in " + path.string()};
        }
        const auto length = little_endian_length(source, offset);
        offset += 4U;
        if (length > source.size() - offset)
        {
            throw std::invalid_argument{"Truncated PFB segment in " + path.string()};
        }

        result.bytes.append(source, offset, length);
        if (segment_type == 2U)
        {
            encountered_binary = true;
            result.encrypted_length += length;
        }
        else if (encountered_binary)
        {
            result.fixed_content_length += length;
        }
        else
        {
            result.clear_text_length += length;
        }
        offset += length;
    }
    if (!encountered_end || result.clear_text_length == 0U || result.encrypted_length == 0U)
    {
        throw std::invalid_argument{"Incomplete Type 1 PFB program: " + path.string()};
    }
    return result;
}

struct AfmData
{
    std::string postscript_name{};
    dans::document::fonts::FontBoundingBox bounding_box{};
    double ascent{};
    double descent{};
    double cap_height{};
    double x_height{};
    std::array<double, 256> widths{};
    std::array<std::string, 256> glyph_names{};
    std::array<bool, 256> has_glyph{};
    std::unordered_map<std::string, double> kerning{};
    double design_size{};
    double space_stretch_points{};
    double space_shrink_points{};
    double extra_sentence_space_points{};
};

auto parse_character_metric(const std::string_view line, AfmData& data) -> void
{
    auto code = -1;
    auto width = double{};
    auto name = std::string{};
    auto remainder = line;
    while (!remainder.empty())
    {
        const auto delimiter = remainder.find(';');
        const auto field = trim(remainder.substr(0, delimiter));
        if (field.starts_with("C "))
        {
            code = parse_number<int>(value_after_prefix(field, "C "), "AFM character code");
        }
        else if (field.starts_with("WX "))
        {
            width = parse_number<double>(value_after_prefix(field, "WX "), "AFM glyph width");
        }
        else if (field.starts_with("N "))
        {
            name = std::string{value_after_prefix(field, "N ")};
        }
        if (delimiter == std::string_view::npos)
        {
            break;
        }
        remainder.remove_prefix(delimiter + 1U);
    }
    if (code < 0 || code > 255)
    {
        return;
    }
    const auto index = static_cast<usize>(code);
    data.widths[index] = width;
    data.glyph_names[index] = std::move(name);
    data.has_glyph[index] = true;
}

auto parse_afm_line(const std::string_view line, AfmData& data) -> void
{
    if (line.starts_with("FontName "))
    {
        data.postscript_name = value_after_prefix(line, "FontName ");
    }
    else if (line.starts_with("FontBBox "))
    {
        std::istringstream values{std::string{value_after_prefix(line, "FontBBox ")}};
        values >> data.bounding_box.left >> data.bounding_box.bottom >> data.bounding_box.right
            >> data.bounding_box.top;
        if (!values)
        {
            throw std::invalid_argument{"Malformed AFM FontBBox"};
        }
    }
    else if (line.starts_with("Ascender "))
    {
        data.ascent = parse_number<double>(value_after_prefix(line, "Ascender "), "AFM ascender");
    }
    else if (line.starts_with("Descender "))
    {
        data.descent =
            parse_number<double>(value_after_prefix(line, "Descender "), "AFM descender");
    }
    else if (line.starts_with("CapHeight "))
    {
        data.cap_height =
            parse_number<double>(value_after_prefix(line, "CapHeight "), "AFM cap height");
    }
    else if (line.starts_with("XHeight "))
    {
        data.x_height = parse_number<double>(value_after_prefix(line, "XHeight "), "AFM x-height");
    }
    else if (line.starts_with("C "))
    {
        parse_character_metric(line, data);
    }
    else if (line.starts_with("KPX "))
    {
        std::istringstream values{std::string{value_after_prefix(line, "KPX ")}};
        std::string left;
        std::string right;
        double adjustment{};
        values >> left >> right >> adjustment;
        if (!values)
        {
            throw std::invalid_argument{"Malformed AFM kerning pair"};
        }
        data.kerning.emplace(left + '\n' + right, adjustment);
    }
    else if (line.starts_with("Comment TFM designsize:"))
    {
        data.design_size = parse_number<double>(value_after_colon(line), "AFM TFM design size");
    }
    else if (line.starts_with("Comment TFM fontdimen  3:"))
    {
        data.space_stretch_points =
            parse_number<double>(value_after_colon(line), "AFM space stretch");
    }
    else if (line.starts_with("Comment TFM fontdimen  4:"))
    {
        data.space_shrink_points =
            parse_number<double>(value_after_colon(line), "AFM space shrink");
    }
    else if (line.starts_with("Comment TFM fontdimen  7:"))
    {
        data.extra_sentence_space_points =
            parse_number<double>(value_after_colon(line), "AFM extra sentence space");
    }
}

[[nodiscard]] auto parse_afm(const std::filesystem::path& path) -> AfmData
{
    std::ifstream input{path};
    if (!input)
    {
        throw std::runtime_error{"Could not open font metrics: " + path.string()};
    }
    AfmData result;
    std::string line;
    while (std::getline(input, line))
    {
        parse_afm_line(line, result);
    }
    if (!input.eof())
    {
        throw std::runtime_error{"Could not read font metrics: " + path.string()};
    }
    if (result.postscript_name.empty() || result.design_size <= 0.0
        || result.space_stretch_points <= 0.0 || result.space_shrink_points <= 0.0
        || result.extra_sentence_space_points < 0.0)
    {
        throw std::invalid_argument{"AFM file lacks required TeX font metrics: " + path.string()};
    }
    for (auto code = usize{32}; code <= usize{126}; ++code)
    {
        if (!result.has_glyph[code] || result.glyph_names[code].empty())
        {
            throw std::invalid_argument{
                "AFM file lacks printable ASCII character " + std::to_string(code)
            };
        }
    }
    return result;
}
}  // namespace

namespace dans::document::fonts
{
Type1Font::Type1Font(
    const std::filesystem::path& program_path, const std::filesystem::path& metrics_path
)
{
    auto metrics = parse_afm(metrics_path);
    postscript_name_ = std::move(metrics.postscript_name);
    bounding_box_ = metrics.bounding_box;
    ascent_ = metrics.ascent;
    descent_ = metrics.descent;
    cap_height_ = metrics.cap_height;
    x_height_ = metrics.x_height;
    widths_ = metrics.widths;
    glyph_names_ = std::move(metrics.glyph_names);
    has_glyph_ = metrics.has_glyph;
    kerning_ = std::move(metrics.kerning);
    const auto units_per_design_point = 1000.0 / metrics.design_size;
    space_stretch_ = metrics.space_stretch_points * units_per_design_point;
    space_shrink_ = metrics.space_shrink_points * units_per_design_point;
    extra_sentence_space_ = metrics.extra_sentence_space_points * units_per_design_point;

    auto program = parse_pfb(program_path);
    program_ = std::move(program.bytes);
    clear_text_length_ = program.clear_text_length;
    encrypted_length_ = program.encrypted_length;
    fixed_content_length_ = program.fixed_content_length;
}

auto Type1Font::postscript_name() const noexcept -> std::string_view
{
    return postscript_name_;
}

auto Type1Font::bounding_box() const noexcept -> const FontBoundingBox&
{
    return bounding_box_;
}

auto Type1Font::ascent() const noexcept -> double
{
    return ascent_;
}

auto Type1Font::descent() const noexcept -> double
{
    return descent_;
}

auto Type1Font::cap_height() const noexcept -> double
{
    return cap_height_;
}

auto Type1Font::x_height() const noexcept -> double
{
    return x_height_;
}

auto Type1Font::glyph_width(const u8 character_code) const -> double
{
    const auto index = static_cast<usize>(character_code);
    if (!has_glyph_[index])
    {
        throw std::invalid_argument{
            "The Type 1 font does not encode character " + std::to_string(index)
        };
    }
    return widths_[index];
}

auto Type1Font::kerning(const u8 left_character_code, const u8 right_character_code) const -> double
{
    const auto match = kerning_.find(kerning_key(left_character_code, right_character_code));
    return match == kerning_.end() ? 0.0 : match->second;
}

auto Type1Font::space_stretch() const noexcept -> double
{
    return space_stretch_;
}

auto Type1Font::space_shrink() const noexcept -> double
{
    return space_shrink_;
}

auto Type1Font::extra_sentence_space() const noexcept -> double
{
    return extra_sentence_space_;
}

auto Type1Font::program() const noexcept -> std::string_view
{
    return program_;
}

auto Type1Font::clear_text_length() const noexcept -> usize
{
    return clear_text_length_;
}

auto Type1Font::encrypted_length() const noexcept -> usize
{
    return encrypted_length_;
}

auto Type1Font::fixed_content_length() const noexcept -> usize
{
    return fixed_content_length_;
}

auto Type1Font::kerning_key(const u8 left, const u8 right) const -> std::string
{
    const auto left_index = static_cast<usize>(left);
    const auto right_index = static_cast<usize>(right);
    if (!has_glyph_[left_index] || !has_glyph_[right_index])
    {
        return {};
    }
    return glyph_names_[left_index] + '\n' + glyph_names_[right_index];
}
}  // namespace dans::document::fonts
