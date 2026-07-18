#include "document.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document
{
auto BlockSequence::blocks() const noexcept -> std::span<const std::unique_ptr<DocumentBlock>>
{
    return {blocks_.data(), blocks_.size()};
}

Section::Section(const std::string_view title) : title_{title}
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

auto Document::set_preamble(Preamble preamble) -> void
{
    preamble_ = std::move(preamble);
}

auto Document::clear_preamble() noexcept -> void
{
    preamble_.reset();
}

auto Document::preamble() const noexcept -> const std::optional<Preamble>&
{
    return preamble_;
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
