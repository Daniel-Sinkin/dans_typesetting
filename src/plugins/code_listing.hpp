// src/plugins/code_listing.hpp — define referenceable C++ and Julia source-code blocks.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_CODE_LISTING_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_CODE_LISTING_HPP

#include "plugins/core_paragraph.hpp"
#include "reference_id.hpp"

#include <string>
#include <string_view>

namespace dans::document::plugins
{
enum class CodeLanguage : u8
{
    cpp,
    julia,
};

class CodeListing final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.code.listing";

    CodeListing(
        CodeLanguage language,
        std::string_view code,
        ReferenceId reference_id,
        std::string_view caption
    );

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto language() const noexcept -> CodeLanguage;
    [[nodiscard]] auto code() const noexcept -> std::string_view;
    [[nodiscard]] auto reference_id() const noexcept -> const ReferenceId&;
    [[nodiscard]] auto caption() noexcept -> InlineSequence&;
    [[nodiscard]] auto caption() const noexcept -> const InlineSequence&;

  private:
    CodeLanguage language_{};
    std::string code_{};
    ReferenceId reference_id_;
    InlineSequence caption_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_CODE_LISTING_HPP
