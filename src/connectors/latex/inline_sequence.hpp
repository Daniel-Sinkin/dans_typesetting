// src/connectors/latex/inline_sequence.hpp — connect inline sequences to LaTeX adapters.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_LATEX_INLINE_SEQUENCE_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_LATEX_INLINE_SEQUENCE_HPP

#include "plugins/inline_sequence.hpp"
#include "writers/latex_writer.hpp"

#include <memory>
#include <string_view>
#include <vector>

namespace dans::document::connectors::latex
{
class InlineLatexRenderer;

class InlineLatexOutput
{
  public:
    InlineLatexOutput(writers::LatexOutput& output, const InlineLatexRenderer& renderer) noexcept;

    auto write_raw(std::string_view text) -> void;
    auto write_text(std::string_view text) -> void;
    auto write_inline(const plugins::InlineNode& node) -> void;

  private:
    writers::LatexOutput& output_;
    const InlineLatexRenderer& renderer_;
};

class InlineLatexAdapter
{
  public:
    InlineLatexAdapter() = default;
    virtual ~InlineLatexAdapter() = default;

    InlineLatexAdapter(const InlineLatexAdapter&) = delete;
    auto operator=(const InlineLatexAdapter&) -> InlineLatexAdapter& = delete;
    InlineLatexAdapter(InlineLatexAdapter&&) = delete;
    auto operator=(InlineLatexAdapter&&) -> InlineLatexAdapter& = delete;

    [[nodiscard]] virtual auto inline_type_id() const noexcept -> std::string_view = 0;
    virtual auto serialize(const plugins::InlineNode& node, InlineLatexOutput& output) const
        -> void = 0;
};

class InlineLatexRenderer final
{
  public:
    auto register_inline_adapter(std::unique_ptr<InlineLatexAdapter> adapter) -> void;
    [[nodiscard]] auto supports_inline(std::string_view inline_type_id) const noexcept -> bool;
    auto serialize(const plugins::InlineSequence& sequence, writers::LatexOutput& output) const
        -> void;

  private:
    friend class InlineLatexOutput;

    [[nodiscard]] auto inline_adapter_for(std::string_view inline_type_id) const noexcept
        -> const InlineLatexAdapter*;
    auto emit_inline(const plugins::InlineNode& node, InlineLatexOutput& output) const -> void;

    std::vector<std::unique_ptr<InlineLatexAdapter>> inline_adapters_{};
};
}  // namespace dans::document::connectors::latex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_LATEX_INLINE_SEQUENCE_HPP
