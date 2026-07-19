// src/plugins/paragraph.hpp — define ordinary text leaves and paragraph blocks.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_PARAGRAPH_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_PARAGRAPH_HPP

#include "document.hpp"
#include "plugins/inline_sequence.hpp"
#include "plugins/text.hpp"

#include <string_view>

namespace dans::document::plugins
{
class Paragraph final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.core.paragraph";

    Paragraph() = default;
    explicit Paragraph(std::string_view text);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto inlines() noexcept -> InlineSequence&;
    [[nodiscard]] auto inlines() const noexcept -> const InlineSequence&;
    auto append_text(std::string_view text, TextStyle style = TextStyle::normal) -> Text&;

  private:
    InlineSequence inlines_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_PARAGRAPH_HPP
