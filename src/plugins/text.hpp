// src/plugins/text.hpp — define the ordinary styled-text inline leaf.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_TEXT_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_TEXT_HPP

#include "common.hpp"
#include "plugins/inline_sequence.hpp"

#include <string>
#include <string_view>

namespace dans::document::plugins
{
enum class TextStyle : u8
{
    normal,
    bold,
    italic,
    bold_italic,
};

class Text final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.core.text";

    explicit Text(std::string_view text, TextStyle style = TextStyle::normal);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto text() const noexcept -> std::string_view;
    [[nodiscard]] auto style() const noexcept -> TextStyle;

  private:
    std::string text_{};
    TextStyle style_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_TEXT_HPP
