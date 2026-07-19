// Lower item-list presentation and inline item content to LaTeX.
#include "connectors/latex/item_list.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::connectors::latex
{
ItemListLatexAdapter::ItemListLatexAdapter(
    std::shared_ptr<const InlineLatexRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A list LaTeX adapter requires an inline renderer"};
    }
}

auto ItemListLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::ItemList::k_type_id;
}

auto ItemListLatexAdapter::serialize(const DocumentBlock& block, writers::LatexOutput& output) const
    -> void
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

    switch (list->presentation())
    {
        case plugins::ListPresentation::itemized:
            output.write_raw("\\begin{itemize}\n");
            break;
        case plugins::ListPresentation::enumerated:
            output.write_raw("\\begin{enumerate}\n");
            break;
    }

    for (const auto& item : list->items())
    {
        if (item->inlines().nodes().empty())
        {
            throw std::invalid_argument{"A rendered list item requires inline content"};
        }
        output.write_raw("\\item ");
        inline_renderer_->serialize(item->inlines(), output);
        output.write_raw("\n");
    }

    switch (list->presentation())
    {
        case plugins::ListPresentation::itemized:
            output.write_raw("\\end{itemize}\n\n");
            return;
        case plugins::ListPresentation::enumerated:
            output.write_raw("\\end{enumerate}\n\n");
            return;
    }
    throw std::logic_error{"Unknown item-list presentation"};
}
}  // namespace dans::document::connectors::latex
