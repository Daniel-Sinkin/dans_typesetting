// src/connectors/markdown/inline_sequence.hpp — connect inline sequences to Markdown adapters.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_INLINE_SEQUENCE_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_INLINE_SEQUENCE_HPP

#include "plugins/inline_sequence.hpp"
#include "writers/markdown_writer.hpp"

#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace dans::document::connectors::markdown
{
class InlineMarkdownRenderer;

class InlineMarkdownOutput
{
  public:
    auto write_raw(std::string_view text) -> void;
    auto write_text(std::string_view text) -> void;
    auto write_inline(const plugins::InlineNode& node) -> void;
    auto write_inlines(const plugins::InlineSequence& sequence) -> void;
    [[nodiscard]] auto render_inlines(const plugins::InlineSequence& sequence) const -> std::string;
    [[nodiscard]] auto context() noexcept -> writers::MarkdownOutput&;

  private:
    friend class InlineMarkdownRenderer;

    InlineMarkdownOutput(
        std::string& buffer,
        const InlineMarkdownRenderer& renderer,
        writers::MarkdownOutput& context
    ) noexcept;

    std::string& buffer_;
    const InlineMarkdownRenderer& renderer_;
    writers::MarkdownOutput& context_;
};

class InlineMarkdownAdapter
{
  public:
    InlineMarkdownAdapter() = default;
    virtual ~InlineMarkdownAdapter() = default;

    InlineMarkdownAdapter(const InlineMarkdownAdapter&) = delete;
    auto operator=(const InlineMarkdownAdapter&) -> InlineMarkdownAdapter& = delete;
    InlineMarkdownAdapter(InlineMarkdownAdapter&&) = delete;
    auto operator=(InlineMarkdownAdapter&&) -> InlineMarkdownAdapter& = delete;

    [[nodiscard]] virtual auto inline_type_id() const noexcept -> std::string_view = 0;
    virtual auto serialize(const plugins::InlineNode& node, InlineMarkdownOutput& output) const
        -> void = 0;
};

class InlineMarkdownRenderer final
{
  public:
    auto register_inline_adapter(std::unique_ptr<InlineMarkdownAdapter> adapter) -> void;
    [[nodiscard]] auto supports_inline(std::string_view inline_type_id) const noexcept -> bool;
    [[nodiscard]] auto
    render(const plugins::InlineSequence& sequence, writers::MarkdownOutput& context) const
        -> std::string;

  private:
    friend class InlineMarkdownOutput;

    [[nodiscard]] auto inline_adapter_for(std::string_view inline_type_id) const noexcept
        -> const InlineMarkdownAdapter*;
    auto emit_inline(const plugins::InlineNode& node, InlineMarkdownOutput& output) const -> void;

    std::vector<std::unique_ptr<InlineMarkdownAdapter>> inline_adapters_{};
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_INLINE_SEQUENCE_HPP
