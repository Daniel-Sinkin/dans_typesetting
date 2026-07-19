// src/plugins/code_listing.cpp — validate and implement semantic source-code listings.
#include "plugins/code_listing.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::plugins
{
CodeListing::CodeListing(const CodeLanguage language, const std::string_view code)
    : language_{language}, code_{code}
{
    if (code_.empty())
    {
        throw std::invalid_argument{"A code listing must not be empty"};
    }
}

CodeListing::CodeListing(
    const CodeLanguage language, const std::string_view code, const std::string_view caption
)
    : CodeListing{language, code}
{
    if (caption.empty())
    {
        throw std::invalid_argument{"An explicit code-listing caption must not be empty"};
    }
    caption_.add<CoreText>(caption);
}

CodeListing::CodeListing(
    const CodeLanguage language, const std::string_view code, ReferenceId reference_id
)
    : CodeListing{language, code}
{
    reference_id_.emplace(std::move(reference_id));
}

CodeListing::CodeListing(
    const CodeLanguage language,
    const std::string_view code,
    ReferenceId reference_id,
    const std::string_view caption
)
    : CodeListing{language, code, caption}
{
    reference_id_.emplace(std::move(reference_id));
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

auto CodeListing::reference_id() const noexcept -> const std::optional<ReferenceId>&
{
    return reference_id_;
}

auto CodeListing::has_caption() const noexcept -> bool
{
    return !caption_.nodes().empty();
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
