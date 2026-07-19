// src/connectors/markdown/color_span.hpp — connect semantic text colour to Markdown HTML.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_COLOR_SPAN_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_COLOR_SPAN_HPP

#include "connectors/markdown/inline_sequence.hpp"
#include "plugins/color_span.hpp"

namespace dans::document::connectors::markdown
{
class ColorSpanMarkdownAdapter final : public InlineMarkdownAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, InlineMarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_COLOR_SPAN_HPP
