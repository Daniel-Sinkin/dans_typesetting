// src/connectors/markdown/core_paragraph.hpp — connect Core Paragraph to Markdown.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_CORE_PARAGRAPH_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_CORE_PARAGRAPH_HPP

#include "plugins/core_paragraph.hpp"
#include "writers/markdown_writer.hpp"

#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace dans::document::connectors::markdown
{
class CoreParagraphInlineMarkdownRenderer;

class CoreParagraphMarkdownOutput
{
  public:
    auto write_raw(std::string_view text) -> void;
    auto write_text(std::string_view text) -> void;
    auto write_inline(const plugins::InlineNode& node) -> void;
    auto write_inlines(const plugins::InlineSequence& sequence) -> void;
    [[nodiscard]] auto context() const noexcept -> const writers::MarkdownOutput&;

  private:
    friend class CoreParagraphInlineMarkdownRenderer;

    CoreParagraphMarkdownOutput(
        std::string& buffer,
        const CoreParagraphInlineMarkdownRenderer& inline_renderer,
        const writers::MarkdownOutput& context
    ) noexcept;

    std::string& buffer_;
    const CoreParagraphInlineMarkdownRenderer& inline_renderer_;
    const writers::MarkdownOutput& context_;
};

class CoreParagraphInlineMarkdownAdapter
{
  public:
    CoreParagraphInlineMarkdownAdapter() = default;
    virtual ~CoreParagraphInlineMarkdownAdapter() = default;

    CoreParagraphInlineMarkdownAdapter(const CoreParagraphInlineMarkdownAdapter&) = delete;
    auto operator=(const CoreParagraphInlineMarkdownAdapter&)
        -> CoreParagraphInlineMarkdownAdapter& = delete;
    CoreParagraphInlineMarkdownAdapter(CoreParagraphInlineMarkdownAdapter&&) = delete;
    auto operator=(CoreParagraphInlineMarkdownAdapter&&)
        -> CoreParagraphInlineMarkdownAdapter& = delete;

    [[nodiscard]] virtual auto inline_type_id() const noexcept -> std::string_view = 0;
    virtual auto
    serialize(const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output) const
        -> void = 0;
};

class CoreParagraphInlineMarkdownRenderer final
{
  public:
    auto register_inline_adapter(std::unique_ptr<CoreParagraphInlineMarkdownAdapter> adapter)
        -> void;
    [[nodiscard]] auto supports_inline(std::string_view inline_type_id) const noexcept -> bool;
    [[nodiscard]] auto
    render(const plugins::InlineSequence& sequence, const writers::MarkdownOutput& context) const
        -> std::string;

  private:
    friend class CoreParagraphMarkdownOutput;

    [[nodiscard]] auto inline_adapter_for(std::string_view inline_type_id) const noexcept
        -> const CoreParagraphInlineMarkdownAdapter*;
    auto emit_inline(const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output) const
        -> void;

    std::vector<std::unique_ptr<CoreParagraphInlineMarkdownAdapter>> inline_adapters_{};
};

class CoreParagraphMarkdownAdapter final : public writers::MarkdownBlockAdapter
{
  public:
    explicit CoreParagraphMarkdownAdapter(
        std::shared_ptr<const CoreParagraphInlineMarkdownRenderer> inline_renderer
    );

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::MarkdownOutput& output) const
        -> void override;

  private:
    std::shared_ptr<const CoreParagraphInlineMarkdownRenderer> inline_renderer_{};
};

class CoreTextMarkdownAdapter final : public CoreParagraphInlineMarkdownAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, CoreParagraphMarkdownOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::markdown

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_MARKDOWN_CORE_PARAGRAPH_HPP
