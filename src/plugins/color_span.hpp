#ifndef DANS_TYPESETTING_SRC_PLUGINS_COLOR_SPAN_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_COLOR_SPAN_HPP

#include "common.hpp"
#include "plugins/inline_sequence.hpp"

#include <string_view>

namespace dans::document::plugins
{
struct RgbColor
{
    u8 red{};
    u8 green{};
    u8 blue{};
};

class ColorSpan final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.inline.color_span";

    explicit ColorSpan(RgbColor color) noexcept;

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto color() const noexcept -> RgbColor;
    [[nodiscard]] auto inlines() noexcept -> InlineSequence&;
    [[nodiscard]] auto inlines() const noexcept -> const InlineSequence&;

  private:
    RgbColor color_{};
    InlineSequence inlines_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_COLOR_SPAN_HPP
