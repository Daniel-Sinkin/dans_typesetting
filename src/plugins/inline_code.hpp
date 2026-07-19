// src/plugins/inline_code.hpp — define a semantic inline source-code leaf.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_INLINE_CODE_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_INLINE_CODE_HPP

#include "plugins/inline_sequence.hpp"

#include <string>
#include <string_view>

namespace dans::document::plugins
{
// InlineCode deliberately models source text rather than a presentation style.
// This keeps code distinct from ordinary prose and lets each writer choose an
// appropriate monospace representation.
class InlineCode final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.code.inline";

    explicit InlineCode(std::string_view code);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto code() const noexcept -> std::string_view;

  private:
    std::string code_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_INLINE_CODE_HPP
