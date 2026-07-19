// Implement the writer-independent rich-table semantic contract.
#include "plugins/table.hpp"

#include <memory>
#include <stdexcept>
#include <utility>

namespace dans::document::plugins
{
auto TableCell::inlines() noexcept -> InlineSequence&
{
    return inlines_;
}

auto TableCell::inlines() const noexcept -> const InlineSequence&
{
    return inlines_;
}

auto TableCell::append_text(const std::string_view text, const TextStyle style) -> Text&
{
    return inlines_.add<Text>(text, style);
}

TableRow::TableRow(const usize column_count)
{
    cells_.reserve(column_count);
    for (usize index{}; index < column_count; ++index)
    {
        cells_.push_back(std::make_unique<TableCell>());
    }
}

auto TableRow::cell(const usize index) -> TableCell&
{
    return *cells_.at(index);
}

auto TableRow::cell(const usize index) const -> const TableCell&
{
    return *cells_.at(index);
}

auto TableRow::cells() const noexcept -> std::span<const std::unique_ptr<TableCell>>
{
    return {cells_.data(), cells_.size()};
}

Table::Table(
    const usize column_count,
    const std::string_view caption,
    std::optional<ReferenceId> reference_id
)
    : column_count_{column_count}, column_alignments_(column_count, TableColumnAlignment::left),
      reference_id_{std::move(reference_id)}
{
    if (column_count_ == 0)
    {
        throw std::invalid_argument{"A semantic table requires at least one column"};
    }
    caption_.add<Text>(caption);
}

auto Table::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Table::column_count() const noexcept -> usize
{
    return column_count_;
}

auto Table::header_rows() const noexcept -> usize
{
    return header_rows_;
}

auto Table::set_header_rows(const usize count) -> void
{
    if (count > rows_.size())
    {
        throw std::out_of_range{"A table cannot have more header rows than rows"};
    }
    header_rows_ = count;
}

auto Table::column_alignment(const usize index) const -> TableColumnAlignment
{
    return column_alignments_.at(index);
}

auto Table::set_column_alignment(const usize index, const TableColumnAlignment alignment) -> void
{
    column_alignments_.at(index) = alignment;
}

auto Table::reference_id() const noexcept -> const std::optional<ReferenceId>&
{
    return reference_id_;
}

auto Table::caption() noexcept -> InlineSequence&
{
    return caption_;
}

auto Table::caption() const noexcept -> const InlineSequence&
{
    return caption_;
}

auto Table::add_row() -> TableRow&
{
    auto row = std::make_unique<TableRow>(column_count_);
    auto& result = *row;
    rows_.push_back(std::move(row));
    return result;
}

auto Table::rows() const noexcept -> std::span<const std::unique_ptr<TableRow>>
{
    return {rows_.data(), rows_.size()};
}
}  // namespace dans::document::plugins
