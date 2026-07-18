// src/plugins/reference.cpp — implement the inline semantic reference node.
#include "plugins/reference.hpp"

#include <utility>

namespace dans::document::plugins
{
Reference::Reference(ReferenceId target) : target_{std::move(target)}
{
}

auto Reference::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Reference::target() const noexcept -> const ReferenceId&
{
    return target_;
}
}  // namespace dans::document::plugins
