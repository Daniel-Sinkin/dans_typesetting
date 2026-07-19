#ifndef DANS_TYPESETTING_SRC_DOCUMENT_HPP
#define DANS_TYPESETTING_SRC_DOCUMENT_HPP

#include "common.hpp"
#include "reference_id.hpp"

#include <concepts>
#include <memory>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace dans::document
{
class BlockSequence;

struct Metadata
{
    u16 major{};
    u16 minor{};
    u32 patch{};
};

// The document core's semantic primitive. A block participates in document
// flow, but deliberately carries no PDF layout dimensions or backend behavior.
class DocumentBlock
{
  public:
    DocumentBlock() = default;
    virtual ~DocumentBlock() = default;

    DocumentBlock(const DocumentBlock&) = delete;
    auto operator=(const DocumentBlock&) -> DocumentBlock& = delete;
    DocumentBlock(DocumentBlock&&) = delete;
    auto operator=(DocumentBlock&&) -> DocumentBlock& = delete;

    [[nodiscard]] virtual auto type_id() const noexcept -> std::string_view = 0;
    [[nodiscard]] virtual auto child_sequence_count() const noexcept -> usize;
    [[nodiscard]] virtual auto child_sequence_id(usize index) const -> std::string_view;
    [[nodiscard]] virtual auto child_sequence(usize index) const -> const BlockSequence&;
};

// Owns semantic blocks in authoring order. Sections use the same sequence for
// their bodies, so structural and plugin-provided blocks can be interleaved.
class BlockSequence
{
  public:
    template <typename Block, typename... Args>
        requires std::derived_from<Block, DocumentBlock>
    auto add(Args&&... args) -> Block&
    {
        auto block = std::make_unique<Block>(std::forward<Args>(args)...);
        auto& result = *block;
        blocks_.push_back(std::move(block));
        return result;
    }

    [[nodiscard]] auto blocks() const noexcept -> std::span<const std::unique_ptr<DocumentBlock>>;

  private:
    std::vector<std::unique_ptr<DocumentBlock>> blocks_{};
};

// A core structural block. Nesting sections constructs a valid hierarchy
// without storing error-prone numeric heading levels in the document model.
class Section final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.core.section";

    explicit Section(
        std::string_view title, std::optional<ReferenceId> reference_id = std::nullopt
    );

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto child_sequence_count() const noexcept -> usize override;
    [[nodiscard]] auto child_sequence_id(usize index) const -> std::string_view override;
    [[nodiscard]] auto child_sequence(usize index) const -> const BlockSequence& override;
    [[nodiscard]] auto title() const noexcept -> std::string_view;
    [[nodiscard]] auto reference_id() const noexcept -> const std::optional<ReferenceId>&;

    [[nodiscard]] auto blocks() noexcept -> BlockSequence&;
    [[nodiscard]] auto blocks() const noexcept -> const BlockSequence&;

  private:
    std::string title_{};
    std::optional<ReferenceId> reference_id_{};
    BlockSequence blocks_{};
};

class Document
{
  public:
    explicit Document(Metadata metadata = {});

    [[nodiscard]] auto metadata() noexcept -> Metadata&;
    [[nodiscard]] auto metadata() const noexcept -> const Metadata&;

    [[nodiscard]] auto blocks() noexcept -> BlockSequence&;
    [[nodiscard]] auto blocks() const noexcept -> const BlockSequence&;

  private:
    Metadata metadata_{};
    BlockSequence blocks_{};
};
}  // namespace dans::document

#endif  // DANS_TYPESETTING_SRC_DOCUMENT_HPP
