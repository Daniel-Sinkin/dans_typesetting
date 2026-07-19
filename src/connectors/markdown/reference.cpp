// src/connectors/markdown/reference.cpp — resolve writer-owned labels and anchors.
#include "connectors/markdown/reference.hpp"

#include <stdexcept>

namespace dans::document::connectors::markdown
{
auto ReferenceMarkdownAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Reference::k_type_id;
}

auto ReferenceMarkdownAdapter::serialize(
    const plugins::InlineNode& node, InlineMarkdownOutput& output
) const -> void
{
    const auto* reference = dynamic_cast<const plugins::Reference*>(&node);
    if (reference == nullptr)
    {
        throw std::invalid_argument{"The reference adapter received a different inline type"};
    }
    output.write_raw(output.context().reference_link(reference->target()));
}
}  // namespace dans::document::connectors::markdown
