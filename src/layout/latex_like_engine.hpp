// src/layout/latex_like_engine.hpp — lay semantic blocks onto TeX-like fixed-point pages.
#ifndef DANS_TYPESETTING_SRC_LAYOUT_LATEX_LIKE_ENGINE_HPP
#define DANS_TYPESETTING_SRC_LAYOUT_LATEX_LIKE_ENGINE_HPP

#include "document.hpp"
#include "fonts/type1_font.hpp"
#include "layout/page_layout.hpp"

#include <memory>
#include <string_view>
#include <vector>

namespace dans::document::layout
{
struct LatexLikeStyle
{
    PageSize page_size{};
    ScaledPoint text_left{};
    ScaledPoint text_width{};
    ScaledPoint first_baseline_y{};
    ScaledPoint last_baseline_y{};
    ScaledPoint footer_baseline_y{};
    ScaledPoint paragraph_indent{};
    ScaledPoint baseline_skip{};
    ScaledPoint font_size{};

    [[nodiscard]] static auto article_11pt_a4() -> LatexLikeStyle;
};

class LatexLikeOutput
{
  public:
    auto write_paragraph(std::string_view text) -> void;

  private:
    friend class LatexLikeEngine;
    class Impl;

    explicit LatexLikeOutput(Impl& implementation) noexcept;

    Impl& implementation_;
};

class LatexLikeBlockAdapter
{
  public:
    LatexLikeBlockAdapter() = default;
    virtual ~LatexLikeBlockAdapter() = default;

    LatexLikeBlockAdapter(const LatexLikeBlockAdapter&) = delete;
    auto operator=(const LatexLikeBlockAdapter&) -> LatexLikeBlockAdapter& = delete;
    LatexLikeBlockAdapter(LatexLikeBlockAdapter&&) = delete;
    auto operator=(LatexLikeBlockAdapter&&) -> LatexLikeBlockAdapter& = delete;

    [[nodiscard]] virtual auto block_type_id() const noexcept -> std::string_view = 0;
    virtual auto layout(const DocumentBlock& block, LatexLikeOutput& output) const -> void = 0;
};

class LatexLikeEngine final
{
  public:
    explicit LatexLikeEngine(
        std::shared_ptr<const fonts::Type1Font> roman_font,
        LatexLikeStyle style = LatexLikeStyle::article_11pt_a4()
    );

    auto register_block_adapter(std::unique_ptr<LatexLikeBlockAdapter> adapter) -> void;
    [[nodiscard]] auto supports_block(std::string_view block_type_id) const noexcept -> bool;
    [[nodiscard]] auto layout(const Document& document) const -> PagedDocument;
    [[nodiscard]] auto style() const noexcept -> const LatexLikeStyle&;
    [[nodiscard]] auto roman_font() const noexcept -> const fonts::Type1Font&;

  private:
    [[nodiscard]] auto block_adapter_for(std::string_view block_type_id) const noexcept
        -> const LatexLikeBlockAdapter*;
    auto validate(const Document& document) const -> void;

    std::shared_ptr<const fonts::Type1Font> roman_font_{};
    LatexLikeStyle style_{};
    std::vector<std::unique_ptr<LatexLikeBlockAdapter>> block_adapters_{};
};
}  // namespace dans::document::layout

#endif  // DANS_TYPESETTING_SRC_LAYOUT_LATEX_LIKE_ENGINE_HPP
