// src/connectors/transport/paragraph.hpp — decode canonical paragraph and text payloads.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_TRANSPORT_PARAGRAPH_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_TRANSPORT_PARAGRAPH_HPP

#include "transport/document_materializer.hpp"

#include <memory>
#include <string_view>

namespace dans::document::connectors::transport
{
class ParagraphMaterializer final : public document::transport::CanonicalBlockMaterializer
{
  public:
    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto materialize(
        const document::transport::CanonicalNode& node,
        const document::transport::DocumentMaterializer& materializer
    ) const -> std::unique_ptr<DocumentBlock> override;
};

class TextMaterializer final : public document::transport::CanonicalInlineMaterializer
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto materialize(
        const document::transport::CanonicalNode& node,
        const document::transport::DocumentMaterializer& materializer
    ) const -> std::unique_ptr<plugins::InlineNode> override;
};
}  // namespace dans::document::connectors::transport

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_TRANSPORT_PARAGRAPH_HPP
