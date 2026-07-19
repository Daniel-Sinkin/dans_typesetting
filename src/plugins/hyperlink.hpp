// src/plugins/hyperlink.hpp — define a clickable inline link with semantic label content.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_HYPERLINK_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_HYPERLINK_HPP

#include "plugins/core_paragraph.hpp"

#include <string>
#include <string_view>

namespace dans::document::plugins
{
// Hyperlink is an inline extension rather than a property of CoreText. Its
// label uses the paragraph inline contract, allowing styled and coloured text
// while keeping the target independent of any writer's URL syntax.
class Hyperlink final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.inline.hyperlink";

    explicit Hyperlink(std::string_view target);
    Hyperlink(std::string_view target, std::string_view label);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto target() const noexcept -> std::string_view;
    [[nodiscard]] auto label() noexcept -> InlineSequence&;
    [[nodiscard]] auto label() const noexcept -> const InlineSequence&;

  private:
    std::string target_{};
    InlineSequence label_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_HYPERLINK_HPP
