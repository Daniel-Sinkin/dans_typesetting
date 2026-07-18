#ifndef DANS_TYPESETTING_SRC_PLUGINS_CORE_PARAGRAPH_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_CORE_PARAGRAPH_HPP

#include "document.hpp"

#include <concepts>
#include <memory>
#include <span>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace dans::document::plugins
{
// The Core Paragraph module's extension contract. It is intentionally not part
// of the document core: only paragraph-like hosts and their connectors consume
// inline nodes.
class InlineNode
{
  public:
    InlineNode() = default;
    virtual ~InlineNode() = default;

    InlineNode(const InlineNode&) = delete;
    auto operator=(const InlineNode&) -> InlineNode& = delete;
    InlineNode(InlineNode&&) = delete;
    auto operator=(InlineNode&&) -> InlineNode& = delete;

    [[nodiscard]] virtual auto type_id() const noexcept -> std::string_view = 0;
};

// Owns inline nodes in textual order. New inline plugin modules extend this
// sequence without requiring Core Paragraph to know their concrete types.
class InlineSequence
{
  public:
    template <typename Node, typename... Args>
        requires std::derived_from<Node, InlineNode>
    auto add(Args&&... args) -> Node&
    {
        auto node = std::make_unique<Node>(std::forward<Args>(args)...);
        auto& result = *node;
        nodes_.push_back(std::move(node));
        return result;
    }

    [[nodiscard]] auto nodes() const noexcept -> std::span<const std::unique_ptr<InlineNode>>;

  private:
    std::vector<std::unique_ptr<InlineNode>> nodes_{};
};

class CoreText final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.core.text";

    explicit CoreText(std::string_view text);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto text() const noexcept -> std::string_view;

  private:
    std::string text_{};
};

class CoreParagraph final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.core.paragraph";

    CoreParagraph() = default;
    explicit CoreParagraph(std::string_view text);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto inlines() noexcept -> InlineSequence&;
    [[nodiscard]] auto inlines() const noexcept -> const InlineSequence&;
    auto append_text(std::string_view text) -> CoreText&;

  private:
    InlineSequence inlines_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_CORE_PARAGRAPH_HPP
