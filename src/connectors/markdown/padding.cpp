// Portable Markdown has no dependable inset primitive; retain all nested content.
#include "connectors/markdown/padding.hpp"

#include <stdexcept>

namespace dans::document::connectors::markdown
{
auto PaddingMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Padding::k_type_id;
}

auto PaddingMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* padding = dynamic_cast<const plugins::Padding*>(&block);
    if (padding == nullptr)
    {
        throw std::invalid_argument{"The Padding adapter received a different block type"};
    }
    output.write_blocks(padding->content());
}
}  // namespace dans::document::connectors::markdown
