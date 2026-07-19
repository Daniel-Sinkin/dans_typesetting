// src/plugins/reference.hpp — define an inline reference to a semantic target.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_REFERENCE_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_REFERENCE_HPP

#include "plugins/inline_sequence.hpp"
#include "reference_id.hpp"

#include <string_view>

namespace dans::document::plugins
{
// An inline reference to any referenceable semantic object. The target's kind
// and visible number are resolved by the exporter, not duplicated here.
class Reference final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.inline.reference";

    explicit Reference(ReferenceId target);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto target() const noexcept -> const ReferenceId&;

  private:
    ReferenceId target_;
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_REFERENCE_HPP
