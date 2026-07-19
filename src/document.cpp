#include "document.hpp"

#include <stdexcept>

namespace dans::document
{
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
