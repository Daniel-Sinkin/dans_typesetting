// src/connectors/latex/inline_code.cpp — render inline code without raw LaTeX inclusion.
#include "connectors/latex/inline_code.hpp"

#include "plugins/inline_code.hpp"

#include <stdexcept>

namespace dans::document::connectors::latex
{
auto InlineCodeLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::InlineCode::k_type_id;
}

auto InlineCodeLatexAdapter::serialize(
    const plugins::InlineNode& node, InlineLatexOutput& output
) const -> void
{
    const auto* inline_code = dynamic_cast<const plugins::InlineCode*>(&node);
    if (inline_code == nullptr)
    {
        throw std::invalid_argument{"The inline-code adapter received a different inline type"};
    }

    output.write_raw("\\texttt{");
    output.write_text(inline_code->code());
    output.write_raw("}");
}
}  // namespace dans::document::connectors::latex
