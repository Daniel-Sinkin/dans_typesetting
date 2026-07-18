// src/connectors/latex/reference.cpp — render semantic references through LaTeX autoref.
#include "connectors/latex/reference.hpp"

#include <stdexcept>

namespace dans::document::connectors::latex
{
auto ReferenceLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Reference::k_type_id;
}

auto ReferenceLatexAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphLatexOutput& output
) const -> void
{
    const auto* reference = dynamic_cast<const plugins::Reference*>(&node);
    if (reference == nullptr)
    {
        throw std::invalid_argument{"The reference adapter received a different inline type"};
    }

    output.write_raw("\\autoref{");
    output.write_raw(reference->target().value());
    output.write_raw("}");
}
}  // namespace dans::document::connectors::latex
