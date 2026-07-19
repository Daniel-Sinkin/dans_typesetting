// Semantic rich-table data consuming the shared Inline Sequence contract.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_TABLE_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_TABLE_HPP

#include "document.hpp"
#include "plugins/inline_sequence.hpp"
#include "plugins/text.hpp"
#include "reference_id.hpp"

#include <memory>
#include <optional>
#include <span>
#include <string_view>
#include <vector>

namespace dans::document::plugins
{
enum class TableColumnAlignment : u8
{
    left,
    center,
    right,
};

class TableCell final
{
  public:
    [[nodiscard]] auto inlines() noexcept -> InlineSequence&;
    [[nodiscard]] auto inlines() const noexcept -> const InlineSequence&;
    auto append_text(std::string_view text, TextStyle style = TextStyle::normal) -> Text&;

  private:
    InlineSequence inlines_{};
};

class TableRow final
{
  public:
    explicit TableRow(usize column_count);

    [[nodiscard]] auto cell(usize index) -> TableCell&;
    [[nodiscard]] auto cell(usize index) const -> const TableCell&;
    [[nodiscard]] auto cells() const noexcept -> std::span<const std::unique_ptr<TableCell>>;

  private:
    std::vector<std::unique_ptr<TableCell>> cells_{};
};

// A table owns its rectangular structure, header role, column alignment, and
// inline-rich cells. Writers derive numbering and physical layout.
class Table final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.table";

    Table(
        usize column_count,
        std::string_view caption,
        std::optional<ReferenceId> reference_id = std::nullopt
    );

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto column_count() const noexcept -> usize;
    [[nodiscard]] auto header_rows() const noexcept -> usize;
    auto set_header_rows(usize count) -> void;
    [[nodiscard]] auto column_alignment(usize index) const -> TableColumnAlignment;
    auto set_column_alignment(usize index, TableColumnAlignment alignment) -> void;
    [[nodiscard]] auto reference_id() const noexcept -> const std::optional<ReferenceId>&;
    [[nodiscard]] auto caption() noexcept -> InlineSequence&;
    [[nodiscard]] auto caption() const noexcept -> const InlineSequence&;
    auto add_row() -> TableRow&;
    [[nodiscard]] auto rows() const noexcept -> std::span<const std::unique_ptr<TableRow>>;

  private:
    usize column_count_{};
    usize header_rows_{};
    std::vector<TableColumnAlignment> column_alignments_{};
    std::optional<ReferenceId> reference_id_{};
    InlineSequence caption_{};
    std::vector<std::unique_ptr<TableRow>> rows_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_TABLE_HPP
