// Map em-based Padding to a breakable adjustwidth region and vertical space.
#include "connectors/latex/padding.hpp"

#include "connectors/latex/graphics.hpp"

#include <stdexcept>

namespace dans::document::connectors::latex
{
auto PaddingLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Padding::k_type_id;
}

auto PaddingLatexAdapter::serialize(const DocumentBlock& block, writers::LatexOutput& output) const
    -> void
{
    const auto* padding = dynamic_cast<const plugins::Padding*>(&block);
    if (padding == nullptr)
    {
        throw std::invalid_argument{"The Padding adapter received a different block type"};
    }
    const auto insets = padding->insets();
    output.write_raw("\\vspace*{");
    output.write_raw(detail::decimal(insets.top_em));
    output.write_raw("em}\n\\begin{adjustwidth}{");
    output.write_raw(detail::decimal(insets.left_em));
    output.write_raw("em}{");
    output.write_raw(detail::decimal(insets.right_em));
    output.write_raw("em}\n");
    output.write_blocks(padding->content());
    output.write_raw("\\end{adjustwidth}\n\\vspace*{");
    output.write_raw(detail::decimal(insets.bottom_em));
    output.write_raw("em}\n\n");
}
}  // namespace dans::document::connectors::latex
