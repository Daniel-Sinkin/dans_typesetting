// src/plugins/inline_sequence.cpp — implement ordered inline-node storage.
#include "plugins/inline_sequence.hpp"

#include <stdexcept>

namespace dans::document::plugins
{
auto InlineSequence::append(std::unique_ptr<InlineNode> node) -> InlineNode&
{
    if (node == nullptr)
    {
        throw std::invalid_argument{"An inline sequence cannot append a null node"};
    }
    auto& result = *node;
    nodes_.push_back(std::move(node));
    return result;
}

auto InlineSequence::nodes() const noexcept -> std::span<const std::unique_ptr<InlineNode>>
{
    return {nodes_.data(), nodes_.size()};
}
}  // namespace dans::document::plugins
