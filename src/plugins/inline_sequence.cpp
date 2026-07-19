// src/plugins/inline_sequence.cpp — implement ordered inline-node storage.
#include "plugins/inline_sequence.hpp"

namespace dans::document::plugins
{
auto InlineSequence::nodes() const noexcept -> std::span<const std::unique_ptr<InlineNode>>
{
    return {nodes_.data(), nodes_.size()};
}
}  // namespace dans::document::plugins
