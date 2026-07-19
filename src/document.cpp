#include "document.hpp"

#include <stdexcept>

namespace dans::document
{
auto DocumentBlock::child_sequence_count() const noexcept -> usize
{
    return 0;
}

auto DocumentBlock::child_sequence_id(const usize) const -> std::string_view
{
    throw std::out_of_range{"A leaf document block does not expose child sequences"};
}

auto DocumentBlock::child_sequence(const usize) const -> const BlockSequence&
{
    throw std::out_of_range{"A leaf document block does not expose child sequences"};
}

auto BlockSequence::blocks() const noexcept -> std::span<const std::unique_ptr<DocumentBlock>>
{
    return {blocks_.data(), blocks_.size()};
}

Section::Section(const std::string_view title, std::optional<ReferenceId> reference_id)
    : title_{title}, reference_id_{std::move(reference_id)}
{
    if (title.empty())
    {
        throw std::invalid_argument{"A document section must have a title"};
    }
}

auto Section::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Section::child_sequence_count() const noexcept -> usize
{
    return 1;
}

auto Section::child_sequence_id(const usize index) const -> std::string_view
{
    if (index != 0)
    {
        throw std::out_of_range{"A section exposes only its body child sequence"};
    }
    return "body";
}

auto Section::child_sequence(const usize index) const -> const BlockSequence&
{
    if (index != 0)
    {
        throw std::out_of_range{"A section exposes only its body child sequence"};
    }
    return blocks_;
}

auto Section::title() const noexcept -> std::string_view
{
    return title_;
}

auto Section::reference_id() const noexcept -> const std::optional<ReferenceId>&
{
    return reference_id_;
}

auto Section::blocks() noexcept -> BlockSequence&
{
    return blocks_;
}

auto Section::blocks() const noexcept -> const BlockSequence&
{
    return blocks_;
}

Document::Document(const Metadata metadata) : metadata_{metadata}
{
}

auto Document::metadata() noexcept -> Metadata&
{
    return metadata_;
}

auto Document::metadata() const noexcept -> const Metadata&
{
    return metadata_;
}

auto Document::blocks() noexcept -> BlockSequence&
{
    return blocks_;
}

auto Document::blocks() const noexcept -> const BlockSequence&
{
    return blocks_;
}
}  // namespace dans::document
