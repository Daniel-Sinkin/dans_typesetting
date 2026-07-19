// src/connectors/markdown/item_list.cpp — lower list structure and shared inline content.
#include "connectors/markdown/item_list.hpp"

#include <stdexcept>
#include <string>
#include <utility>

namespace dans::document::connectors::markdown
{
ItemListMarkdownAdapter::ItemListMarkdownAdapter(
    std::shared_ptr<const InlineMarkdownRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A list Markdown adapter requires an inline renderer"};
    }
}

auto ItemListMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::ItemList::k_type_id;
}

auto ItemListMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* list = dynamic_cast<const plugins::ItemList*>(&block);
    if (list == nullptr)
    {
        throw std::invalid_argument{"The item-list adapter received a different block type"};
    }
    if (list->items().empty())
    {
        throw std::invalid_argument{"A rendered item list requires at least one item"};
    }
    for (const auto& item : list->items())
    {
        if (item->inlines().nodes().empty())
        {
            throw std::invalid_argument{"A rendered list item requires inline content"};
        }
        switch (list->presentation())
        {
            case plugins::ListPresentation::itemized:
                output.write_raw("- ");
                break;
            case plugins::ListPresentation::enumerated:
                output.write_raw("1. ");
                break;
        }
        auto rendered = inline_renderer_->render(item->inlines(), output);
        usize position{};
        while ((position = rendered.find('\n', position)) != std::string::npos)
        {
            rendered.replace(position, 1, "\n   ");
            position += usize{4};
        }
        output.write_raw(rendered);
        output.write_raw("\n");
    }
    output.write_raw("\n");
}
}  // namespace dans::document::connectors::markdown
