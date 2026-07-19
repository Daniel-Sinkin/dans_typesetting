// src/transport/document_materializer.cpp — dispatch canonical nodes through strict plugin
// adapters.
#include "transport/document_materializer.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>
#include <utility>

namespace dans::document::transport
{
auto DocumentMaterializer::register_block_materializer(
    std::unique_ptr<CanonicalBlockMaterializer> materializer
) -> void
{
    if (materializer == nullptr)
    {
        throw std::invalid_argument{"Cannot register a null block materializer"};
    }
    if (materializer->block_type_id().empty())
    {
        throw std::invalid_argument{"A block materializer requires a type ID"};
    }
    if (supports_block(materializer->block_type_id()))
    {
        throw std::invalid_argument{
            "A block materializer is already registered for type '"
            + std::string{materializer->block_type_id()} + "'"
        };
    }
    block_materializers_.push_back(std::move(materializer));
}

auto DocumentMaterializer::register_inline_materializer(
    std::unique_ptr<CanonicalInlineMaterializer> materializer
) -> void
{
    if (materializer == nullptr)
    {
        throw std::invalid_argument{"Cannot register a null inline materializer"};
    }
    if (materializer->inline_type_id().empty())
    {
        throw std::invalid_argument{"An inline materializer requires a type ID"};
    }
    if (supports_inline(materializer->inline_type_id()))
    {
        throw std::invalid_argument{
            "An inline materializer is already registered for type '"
            + std::string{materializer->inline_type_id()} + "'"
        };
    }
    inline_materializers_.push_back(std::move(materializer));
}

auto DocumentMaterializer::supports_block(const std::string_view type_id) const noexcept -> bool
{
    return block_materializer_for(type_id) != nullptr;
}

auto DocumentMaterializer::supports_inline(const std::string_view type_id) const noexcept -> bool
{
    return inline_materializer_for(type_id) != nullptr;
}

auto DocumentMaterializer::materialize(const CanonicalDocument& source) const -> Document
{
    Document document{source.metadata};
    for (const auto& block : source.blocks)
    {
        document.blocks().append(materialize_block(block));
    }
    return document;
}

auto DocumentMaterializer::materialize_block(const CanonicalNode& source) const
    -> std::unique_ptr<DocumentBlock>
{
    const auto* materializer = block_materializer_for(source.type);
    if (materializer == nullptr)
    {
        throw std::runtime_error{
            "No native materializer is registered for block type '" + source.type + "'"
        };
    }
    auto block = materializer->materialize(source, *this);
    if (block == nullptr || block->type_id() != source.type)
    {
        throw std::logic_error{
            "Block materializer for '" + source.type + "' returned an invalid semantic block"
        };
    }
    return block;
}

auto DocumentMaterializer::materialize_inline(const CanonicalNode& source) const
    -> std::unique_ptr<plugins::InlineNode>
{
    const auto* materializer = inline_materializer_for(source.type);
    if (materializer == nullptr)
    {
        throw std::runtime_error{
            "No native materializer is registered for inline type '" + source.type + "'"
        };
    }
    auto node = materializer->materialize(source, *this);
    if (node == nullptr || node->type_id() != source.type)
    {
        throw std::logic_error{
            "Inline materializer for '" + source.type + "' returned an invalid semantic node"
        };
    }
    return node;
}

auto DocumentMaterializer::block_materializer_for(const std::string_view type_id) const noexcept
    -> const CanonicalBlockMaterializer*
{
    const auto match = std::ranges::find_if(
        block_materializers_,
        [type_id](const std::unique_ptr<CanonicalBlockMaterializer>& materializer)
        { return materializer->block_type_id() == type_id; }
    );
    return match == block_materializers_.end() ? nullptr : match->get();
}

auto DocumentMaterializer::inline_materializer_for(const std::string_view type_id) const noexcept
    -> const CanonicalInlineMaterializer*
{
    const auto match = std::ranges::find_if(
        inline_materializers_,
        [type_id](const std::unique_ptr<CanonicalInlineMaterializer>& materializer)
        { return materializer->inline_type_id() == type_id; }
    );
    return match == inline_materializers_.end() ? nullptr : match->get();
}
}  // namespace dans::document::transport
