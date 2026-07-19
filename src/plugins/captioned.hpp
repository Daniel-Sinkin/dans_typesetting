// Generic rich caption and string-keyed numbering around one semantic block.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_CAPTIONED_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_CAPTIONED_HPP

#include "document.hpp"
#include "plugins/inline_sequence.hpp"
#include "reference_id.hpp"

#include <concepts>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

namespace dans::document::plugins
{
class Captioned final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.layout.captioned";
    static constexpr std::string_view k_content_sequence_id = "content";

    explicit Captioned(
        std::string_view category,
        std::string_view caption = {},
        std::optional<ReferenceId> reference_id = std::nullopt
    );
    explicit Captioned(std::nullopt_t, std::string_view caption = {});

    template <typename Block, typename... Args>
        requires std::derived_from<Block, DocumentBlock>
    auto set_content(Args&&... args) -> Block&
    {
        if (has_content())
        {
            throw std::logic_error{"A Captioned block can own exactly one content block"};
        }
        return content_.add<Block>(std::forward<Args>(args)...);
    }

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto child_sequence_count() const noexcept -> usize override;
    [[nodiscard]] auto child_sequence_id(usize index) const -> std::string_view override;
    [[nodiscard]] auto child_sequence(usize index) const -> const BlockSequence& override;

    [[nodiscard]] auto category() const noexcept -> const std::optional<std::string>&;
    [[nodiscard]] auto reference_id() const noexcept -> const std::optional<ReferenceId>&;
    [[nodiscard]] auto caption() noexcept -> InlineSequence&;
    [[nodiscard]] auto caption() const noexcept -> const InlineSequence&;
    [[nodiscard]] auto content() const noexcept -> const BlockSequence&;
    [[nodiscard]] auto has_content() const noexcept -> bool;

  private:
    std::optional<std::string> category_{};
    std::optional<ReferenceId> reference_id_{};
    InlineSequence caption_{};
    BlockSequence content_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_CAPTIONED_HPP
