// Implement the semantic item-list plugin without writer knowledge.
#include "plugins/item_list.hpp"

#include <memory>
#include <utility>

namespace dans::document::plugins
{
auto ListItem::inlines() noexcept -> InlineSequence&
{
    return inlines_;
}

auto ListItem::inlines() const noexcept -> const InlineSequence&
{
    return inlines_;
}

auto ListItem::append_text(const std::string_view text, const TextStyle style) -> Text&
{
    return inlines_.add<Text>(text, style);
}

ItemList::ItemList(const ListPresentation presentation) noexcept : presentation_{presentation}
{
}

auto ItemList::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto ItemList::presentation() const noexcept -> ListPresentation
{
    return presentation_;
}

auto ItemList::set_presentation(const ListPresentation presentation) noexcept -> void
{
    presentation_ = presentation;
}

auto ItemList::add_item() -> ListItem&
{
    auto item = std::make_unique<ListItem>();
    auto& result = *item;
    items_.push_back(std::move(item));
    return result;
}

auto ItemList::add_item(const std::string_view text, const TextStyle style) -> ListItem&
{
    auto& item = add_item();
    item.append_text(text, style);
    return item;
}

auto ItemList::items() const noexcept -> std::span<const std::unique_ptr<ListItem>>
{
    return {items_.data(), items_.size()};
}
}  // namespace dans::document::plugins
