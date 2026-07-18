#include "connectors/latex/latex_mixin.hpp"

#include <stdexcept>

namespace dans::document::connectors::latex
{
auto LatexBlockAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::LatexBlock::k_type_id;
}

auto LatexBlockAdapter::serialize(const DocumentBlock& block, writers::LatexOutput& output) const
    -> void
{
    const auto* latex = dynamic_cast<const plugins::LatexBlock*>(&block);
    if (latex == nullptr)
    {
        throw std::invalid_argument{"The raw-LaTeX adapter received a different block type"};
    }

    output.write_raw(latex->source());
    output.write_raw("\n\n");
}

auto InlineLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::InlineLatex::k_type_id;
}

auto InlineLatexAdapter::serialize(
    const plugins::InlineNode& node, CoreParagraphLatexOutput& output
) const -> void
{
    const auto* latex = dynamic_cast<const plugins::InlineLatex*>(&node);
    if (latex == nullptr)
    {
        throw std::invalid_argument{"The raw-LaTeX adapter received a different inline type"};
    }

    output.write_raw(latex->source());
}
}  // namespace dans::document::connectors::latex
