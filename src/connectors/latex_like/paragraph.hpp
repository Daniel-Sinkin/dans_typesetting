// src/connectors/latex_like/paragraph.hpp — connect paragraphs and text to LaTeX-like layout.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_LIKE_PARAGRAPH_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_LIKE_PARAGRAPH_HPP

#include "layout/latex_like_engine.hpp"
#include "plugins/inline_sequence.hpp"

#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace dans::document::connectors::latex_like
{
class InlineTextOutput
{
  public:
    auto append(std::string_view text) -> void;

  private:
    friend class InlineTextRenderer;

    std::string text_{};
};

class InlineTextAdapter
{
  public:
    InlineTextAdapter() = default;
    virtual ~InlineTextAdapter() = default;

    InlineTextAdapter(const InlineTextAdapter&) = delete;
    auto operator=(const InlineTextAdapter&) -> InlineTextAdapter& = delete;
    InlineTextAdapter(InlineTextAdapter&&) = delete;
    auto operator=(InlineTextAdapter&&) -> InlineTextAdapter& = delete;

    [[nodiscard]] virtual auto inline_type_id() const noexcept -> std::string_view = 0;
    virtual auto append(const plugins::InlineNode& node, InlineTextOutput& output) const
        -> void = 0;
};

class InlineTextRenderer final
{
  public:
    auto register_inline_adapter(std::unique_ptr<InlineTextAdapter> adapter) -> void;
    [[nodiscard]] auto supports_inline(std::string_view inline_type_id) const noexcept -> bool;
    [[nodiscard]] auto render(const plugins::InlineSequence& sequence) const -> std::string;

  private:
    [[nodiscard]] auto inline_adapter_for(std::string_view inline_type_id) const noexcept
        -> const InlineTextAdapter*;

    std::vector<std::unique_ptr<InlineTextAdapter>> inline_adapters_{};
};

class ParagraphAdapter final : public layout::LatexLikeBlockAdapter
{
  public:
    explicit ParagraphAdapter(std::shared_ptr<const InlineTextRenderer> inline_renderer);

    [[nodiscard]] auto block_type_id() const noexcept -> std::string_view override;
    auto layout(const DocumentBlock& block, layout::LatexLikeOutput& output) const -> void override;

  private:
    std::shared_ptr<const InlineTextRenderer> inline_renderer_{};
};

class TextAdapter final : public InlineTextAdapter
{
  public:
    [[nodiscard]] auto inline_type_id() const noexcept -> std::string_view override;
    auto append(const plugins::InlineNode& node, InlineTextOutput& output) const -> void override;
};
}  // namespace dans::document::connectors::latex_like

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_LIKE_PARAGRAPH_HPP
