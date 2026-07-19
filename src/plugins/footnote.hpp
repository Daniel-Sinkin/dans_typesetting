// src/plugins/footnote.hpp — define a semantic inline footnote host.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_FOOTNOTE_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_FOOTNOTE_HPP

#include "plugins/inline_sequence.hpp"
#include "plugins/text.hpp"

#include <string_view>

namespace dans::document::plugins
{
// A footnote owns prose-like inline content while every writer derives its
// visible marker from occurrence order. It deliberately stores no counter.
class Footnote final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.inline.footnote";

    Footnote() = default;
    explicit Footnote(std::string_view text);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto inlines() noexcept -> InlineSequence&;
    [[nodiscard]] auto inlines() const noexcept -> const InlineSequence&;
    auto append_text(std::string_view text, TextStyle style = TextStyle::normal) -> Text&;

  private:
    InlineSequence inlines_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_FOOTNOTE_HPP
