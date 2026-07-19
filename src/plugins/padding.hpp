// Backend-neutral inset intent around one owned block sequence.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_PADDING_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_PADDING_HPP

#include "document.hpp"

#include <string_view>

namespace dans::document::plugins
{
struct PaddingInsets
{
    f64 top_em{};
    f64 right_em{};
    f64 bottom_em{};
    f64 left_em{};
};

class Padding final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.layout.padding";
    static constexpr std::string_view k_content_sequence_id = "content";

    explicit Padding(PaddingInsets insets = {});

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto child_sequence_count() const noexcept -> usize override;
    [[nodiscard]] auto child_sequence_id(usize index) const -> std::string_view override;
    [[nodiscard]] auto child_sequence(usize index) const -> const BlockSequence& override;

    [[nodiscard]] auto insets() const noexcept -> PaddingInsets;
    [[nodiscard]] auto content() noexcept -> BlockSequence&;
    [[nodiscard]] auto content() const noexcept -> const BlockSequence&;

  private:
    PaddingInsets insets_{};
    BlockSequence content_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_PADDING_HPP
