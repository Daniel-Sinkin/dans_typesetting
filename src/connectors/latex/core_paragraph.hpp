#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_CORE_PARAGRAPH_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_CORE_PARAGRAPH_HPP

#include "plugins/core_paragraph.hpp"
#include "writers/latex_writer.hpp"

#include <memory>
#include <string_view>
#include <vector>

namespace dans::document::connectors::latex
{
class CoreParagraphInlineLatexRenderer;

class CoreParagraphLatexOutput
{
  public:
    CoreParagraphLatexOutput(
        writers::LatexOutput& output, const CoreParagraphInlineLatexRenderer& inline_renderer
    ) noexcept;

    auto write_raw(std::string_view text) -> void;
    auto write_text(std::string_view text) -> void;
    auto write_inline(const plugins::InlineNode& node) -> void;

  private:
    writers::LatexOutput& output_;
    const CoreParagraphInlineLatexRenderer& inline_renderer_;
};

class CoreParagraphInlineLatexAdapter
{
  public:
    CoreParagraphInlineLatexAdapter() = default;
    virtual ~CoreParagraphInlineLatexAdapter() = default;

    CoreParagraphInlineLatexAdapter(const CoreParagraphInlineLatexAdapter&) = delete;
    auto operator=(const CoreParagraphInlineLatexAdapter&)
        -> CoreParagraphInlineLatexAdapter& = delete;
    CoreParagraphInlineLatexAdapter(CoreParagraphInlineLatexAdapter&&) = delete;
    auto operator=(CoreParagraphInlineLatexAdapter&&) -> CoreParagraphInlineLatexAdapter& = delete;

    [[nodiscard]] virtual auto inline_type_id() const noexcept -> std::string_view = 0;
    virtual auto serialize(const plugins::InlineNode& node, CoreParagraphLatexOutput& output) const
        -> void = 0;
};

// A reusable connector-side implementation of the Core Paragraph inline
// consumption endpoint. Paragraphs, captions, and future inline-sequence hosts
// share this exact adapter registry instead of acquiring hidden knowledge of
// concrete inline plugins.
class CoreParagraphInlineLatexRenderer final
{
  public:
    auto register_inline_adapter(std::unique_ptr<CoreParagraphInlineLatexAdapter> adapter) -> void;
    [[nodiscard]] auto supports_inline(std::string_view inline_type_id) const noexcept -> bool;
    auto serialize(const plugins::InlineSequence& sequence, writers::LatexOutput& output) const
        -> void;

  private:
    friend class CoreParagraphLatexOutput;

    [[nodiscard]] auto inline_adapter_for(std::string_view inline_type_id) const noexcept
        -> const CoreParagraphInlineLatexAdapter*;
    auto emit_inline(const plugins::InlineNode& node, CoreParagraphLatexOutput& output) const
        -> void;

    std::vector<std::unique_ptr<CoreParagraphInlineLatexAdapter>> inline_adapters_{};
};

class CoreParagraphLatexAdapter final : public writers::LatexBlockAdapter
{
  public:
    explicit CoreParagraphLatexAdapter(
        std::shared_ptr<const CoreParagraphInlineLatexRenderer> inline_renderer
    );

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto serialize(const DocumentBlock& block, writers::LatexOutput& output) const -> void override;

  private:
    std::shared_ptr<const CoreParagraphInlineLatexRenderer> inline_renderer_{};
};

class CoreTextLatexAdapter final : public CoreParagraphInlineLatexAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto serialize(const plugins::InlineNode& node, CoreParagraphLatexOutput& output) const
        -> void override;
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_CORE_PARAGRAPH_HPP
