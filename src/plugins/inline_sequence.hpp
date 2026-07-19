// src/plugins/inline_sequence.hpp — define the extensible ordered-inline foundation.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_INLINE_SEQUENCE_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_INLINE_SEQUENCE_HPP

#include <concepts>
#include <memory>
#include <span>
#include <string_view>
#include <utility>
#include <vector>

namespace dans::document::plugins
{
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

    auto append(std::unique_ptr<InlineNode> node) -> InlineNode&;

    [[nodiscard]] auto nodes() const noexcept -> std::span<const std::unique_ptr<InlineNode>>;

  private:
    std::vector<std::unique_ptr<InlineNode>> nodes_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_INLINE_SEQUENCE_HPP
