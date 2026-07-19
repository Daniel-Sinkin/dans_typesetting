// Semantic ordered/unordered list data extending the Core Paragraph inline contract.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_ITEM_LIST_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_ITEM_LIST_HPP

#include "plugins/core_paragraph.hpp"

#include <memory>
#include <span>
#include <string_view>
#include <vector>

namespace dans::document::plugins
{
enum class ListPresentation : u8
{
    itemized,
    enumerated,
};

// A list item is an inline-sequence host, not a paragraph block. This keeps
// list structure in the plugin while reusing every Core Paragraph extension.
class ListItem final
{
  public:
    [[nodiscard]] auto inlines() noexcept -> InlineSequence&;
    [[nodiscard]] auto inlines() const noexcept -> const InlineSequence&;
    auto append_text(std::string_view text, TextStyle style = TextStyle::normal) -> CoreText&;

  private:
    InlineSequence inlines_{};
};

class ItemList final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.list";

    explicit ItemList(ListPresentation presentation = ListPresentation::itemized) noexcept;

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto presentation() const noexcept -> ListPresentation;
    auto set_presentation(ListPresentation presentation) noexcept -> void;
    auto add_item() -> ListItem&;
    auto add_item(std::string_view text, TextStyle style = TextStyle::normal) -> ListItem&;
    [[nodiscard]] auto items() const noexcept -> std::span<const std::unique_ptr<ListItem>>;

  private:
    ListPresentation presentation_{};
    std::vector<std::unique_ptr<ListItem>> items_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_ITEM_LIST_HPP
