// src/reference_id.hpp — define stable semantic identifiers for reference targets.
#ifndef DANS_TYPESETTING_SRC_REFERENCE_ID_HPP
#define DANS_TYPESETTING_SRC_REFERENCE_ID_HPP

#include <string>
#include <string_view>

namespace dans::document
{
// A stable semantic name for a referenceable document object. Visible numbers
// are deliberately absent: each exporter derives those from document order.
class ReferenceId final
{
  public:
    explicit ReferenceId(std::string_view value);

    [[nodiscard]] auto value() const noexcept -> std::string_view;

  private:
    std::string value_{};
};
}  // namespace dans::document

#endif  // DANS_TYPESETTING_SRC_REFERENCE_ID_HPP
