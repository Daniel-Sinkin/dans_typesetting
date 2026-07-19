// src/fonts/type1_font.hpp — load Type 1 programs and AFM metrics behind one font contract.
#ifndef DANS_TYPESETTING_SRC_FONTS_TYPE1_FONT_HPP
#define DANS_TYPESETTING_SRC_FONTS_TYPE1_FONT_HPP

#include "common.hpp"

#include <array>
#include <filesystem>
#include <string>
#include <string_view>
#include <unordered_map>

namespace dans::document::fonts
{
struct FontBoundingBox
{
    double left{};
    double bottom{};
    double right{};
    double top{};
};

class Type1Font final
{
  public:
    Type1Font(const std::filesystem::path& program_path, const std::filesystem::path& metrics_path);

    [[nodiscard]] auto postscript_name() const noexcept -> std::string_view;
    [[nodiscard]] auto bounding_box() const noexcept -> const FontBoundingBox&;
    [[nodiscard]] auto ascent() const noexcept -> double;
    [[nodiscard]] auto descent() const noexcept -> double;
    [[nodiscard]] auto cap_height() const noexcept -> double;
    [[nodiscard]] auto x_height() const noexcept -> double;

    [[nodiscard]] auto glyph_width(u8 character_code) const -> double;
    [[nodiscard]] auto kerning(u8 left_character_code, u8 right_character_code) const -> double;
    [[nodiscard]] auto space_stretch() const noexcept -> double;
    [[nodiscard]] auto space_shrink() const noexcept -> double;
    [[nodiscard]] auto extra_sentence_space() const noexcept -> double;

    [[nodiscard]] auto program() const noexcept -> std::string_view;
    [[nodiscard]] auto clear_text_length() const noexcept -> usize;
    [[nodiscard]] auto encrypted_length() const noexcept -> usize;
    [[nodiscard]] auto fixed_content_length() const noexcept -> usize;

  private:
    [[nodiscard]] auto kerning_key(u8 left, u8 right) const -> std::string;

    std::string postscript_name_{};
    FontBoundingBox bounding_box_{};
    double ascent_{};
    double descent_{};
    double cap_height_{};
    double x_height_{};
    std::array<double, 256> widths_{};
    std::array<std::string, 256> glyph_names_{};
    std::array<bool, 256> has_glyph_{};
    std::unordered_map<std::string, double> kerning_{};
    double space_stretch_{};
    double space_shrink_{};
    double extra_sentence_space_{};
    std::string program_{};
    usize clear_text_length_{};
    usize encrypted_length_{};
    usize fixed_content_length_{};
};
}  // namespace dans::document::fonts

#endif  // DANS_TYPESETTING_SRC_FONTS_TYPE1_FONT_HPP
