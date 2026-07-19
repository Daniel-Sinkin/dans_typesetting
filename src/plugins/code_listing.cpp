// src/plugins/code_listing.cpp — validate and implement semantic source-code listings.
#include "plugins/code_listing.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::plugins
{
CodeListing::CodeListing(
    const CodeLanguage language,
    const std::string_view code,
    ReferenceId reference_id,
    const std::string_view caption
)
    : language_{language}, code_{code}, reference_id_{std::move(reference_id)}
{
    if (code_.empty())
    {
        throw std::invalid_argument{"A code listing must not be empty"};
    }
    if (caption.empty())
    {
        throw std::invalid_argument{"A referenceable code listing must have a caption"};
    }
    caption_.add<CoreText>(caption);
}

auto CodeListing::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto CodeListing::language() const noexcept -> CodeLanguage
{
    return language_;
}

auto CodeListing::code() const noexcept -> std::string_view
{
    return code_;
}

auto CodeListing::reference_id() const noexcept -> const ReferenceId&
{
    return reference_id_;
}

auto CodeListing::caption() noexcept -> InlineSequence&
{
    return caption_;
}

auto CodeListing::caption() const noexcept -> const InlineSequence&
{
    return caption_;
}
}  // namespace dans::document::plugins
