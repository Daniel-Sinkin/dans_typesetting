// src/transport/document_materializer.hpp — materialize canonical plugin envelopes into a Document.
#ifndef DANS_TYPESETTING_SRC_TRANSPORT_DOCUMENT_MATERIALIZER_HPP
#define DANS_TYPESETTING_SRC_TRANSPORT_DOCUMENT_MATERIALIZER_HPP

#include "plugins/inline_sequence.hpp"
#include "transport/document_transport.hpp"

#include <memory>
#include <string_view>
#include <vector>

namespace dans::document::transport
{
class DocumentMaterializer;

class CanonicalBlockMaterializer
{
  public:
    CanonicalBlockMaterializer() = default;
    virtual ~CanonicalBlockMaterializer() = default;

    CanonicalBlockMaterializer(const CanonicalBlockMaterializer&) = delete;
    auto operator=(const CanonicalBlockMaterializer&) -> CanonicalBlockMaterializer& = delete;
    CanonicalBlockMaterializer(CanonicalBlockMaterializer&&) = delete;
    auto operator=(CanonicalBlockMaterializer&&) -> CanonicalBlockMaterializer& = delete;

    [[nodiscard]] virtual auto block_type_id() const noexcept -> std::string_view = 0;
    [[nodiscard]] virtual auto
    materialize(const CanonicalNode& node, const DocumentMaterializer& materializer) const
        -> std::unique_ptr<DocumentBlock> = 0;
};

class CanonicalInlineMaterializer
{
  public:
    CanonicalInlineMaterializer() = default;
    virtual ~CanonicalInlineMaterializer() = default;

    CanonicalInlineMaterializer(const CanonicalInlineMaterializer&) = delete;
    auto operator=(const CanonicalInlineMaterializer&) -> CanonicalInlineMaterializer& = delete;
    CanonicalInlineMaterializer(CanonicalInlineMaterializer&&) = delete;
    auto operator=(CanonicalInlineMaterializer&&) -> CanonicalInlineMaterializer& = delete;

    [[nodiscard]] virtual auto inline_type_id() const noexcept -> std::string_view = 0;
    [[nodiscard]] virtual auto
    materialize(const CanonicalNode& node, const DocumentMaterializer& materializer) const
        -> std::unique_ptr<plugins::InlineNode> = 0;
};

class DocumentMaterializer final
{
  public:
    auto register_block_materializer(std::unique_ptr<CanonicalBlockMaterializer> materializer)
        -> void;
    auto register_inline_materializer(std::unique_ptr<CanonicalInlineMaterializer> materializer)
        -> void;

    [[nodiscard]] auto supports_block(std::string_view type_id) const noexcept -> bool;
    [[nodiscard]] auto supports_inline(std::string_view type_id) const noexcept -> bool;

    [[nodiscard]] auto materialize(const CanonicalDocument& source) const -> Document;
    [[nodiscard]] auto materialize_block(const CanonicalNode& source) const
        -> std::unique_ptr<DocumentBlock>;
    [[nodiscard]] auto materialize_inline(const CanonicalNode& source) const
        -> std::unique_ptr<plugins::InlineNode>;

  private:
    [[nodiscard]] auto block_materializer_for(std::string_view type_id) const noexcept
        -> const CanonicalBlockMaterializer*;
    [[nodiscard]] auto inline_materializer_for(std::string_view type_id) const noexcept
        -> const CanonicalInlineMaterializer*;

    std::vector<std::unique_ptr<CanonicalBlockMaterializer>> block_materializers_{};
    std::vector<std::unique_ptr<CanonicalInlineMaterializer>> inline_materializers_{};
};
}  // namespace dans::document::transport

#endif  // DANS_TYPESETTING_SRC_TRANSPORT_DOCUMENT_MATERIALIZER_HPP
