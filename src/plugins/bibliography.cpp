// src/plugins/bibliography.cpp — validate normalized citation data.
#include "plugins/bibliography.hpp"

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace
{
auto is_ascii_letter(const char character) noexcept -> bool
{
    return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z');
}

auto is_ascii_digit(const char character) noexcept -> bool
{
    return character >= '0' && character <= '9';
}

auto validate_text(const std::string_view value, const std::string_view field, const bool required)
    -> void
{
    if (required && value.empty())
    {
        throw std::invalid_argument{std::string{field} + " must not be empty"};
    }
    if (value.contains('\n') || value.contains('\r'))
    {
        throw std::invalid_argument{std::string{field} + " must be a single logical line"};
    }
}

auto validate_link_value(const std::string_view value, const std::string_view field) -> void
{
    validate_text(value, field, false);
    for (const char character : value)
    {
        const auto byte = static_cast<unsigned char>(character);
        if (byte < 0x21U || byte == 0x7fU || character == '{' || character == '}'
            || character == '\\')
        {
            throw std::invalid_argument{
                std::string{field}
                + " must not contain whitespace, control characters, braces, or backslashes"
            };
        }
    }
}
}  // namespace

namespace dans::document::plugins
{
CitationKey::CitationKey(const std::string_view value) : value_{value}
{
    if (value.empty() || !is_ascii_letter(value.front()))
    {
        throw std::invalid_argument{"A citation key must begin with an ASCII letter"};
    }
    for (const char character : value)
    {
        if (!is_ascii_letter(character) && !is_ascii_digit(character) && character != '-'
            && character != '_' && character != '.' && character != ':')
        {
            throw std::invalid_argument{
                "A citation key may contain only ASCII letters, digits, '-', '_', '.', and ':'"
            };
        }
    }
}

auto CitationKey::value() const noexcept -> std::string_view
{
    return value_;
}

BibliographyEntry::BibliographyEntry(
    CitationKey key,
    const BibliographyEntryKind kind,
    const std::string_view title,
    std::vector<std::string> authors
)
    : key_{std::move(key)}, kind_{kind}, title_{title}, authors_{std::move(authors)}
{
    validate_text(title_, "A bibliography title", true);
    for (const auto& author : authors_)
    {
        validate_text(author, "A bibliography author", true);
    }
}

auto BibliographyEntry::key() const noexcept -> const CitationKey&
{
    return key_;
}

auto BibliographyEntry::kind() const noexcept -> BibliographyEntryKind
{
    return kind_;
}

auto BibliographyEntry::title() const noexcept -> std::string_view
{
    return title_;
}

auto BibliographyEntry::authors() const noexcept -> std::span<const std::string>
{
    return authors_;
}

auto BibliographyEntry::year() const noexcept -> const std::optional<u16>&
{
    return year_;
}

auto BibliographyEntry::venue() const noexcept -> std::string_view
{
    return venue_;
}

auto BibliographyEntry::publisher() const noexcept -> std::string_view
{
    return publisher_;
}

auto BibliographyEntry::doi() const noexcept -> std::string_view
{
    return doi_;
}

auto BibliographyEntry::url() const noexcept -> std::string_view
{
    return url_;
}

auto BibliographyEntry::set_year(const u16 year) noexcept -> BibliographyEntry&
{
    year_ = year;
    return *this;
}

auto BibliographyEntry::set_venue(const std::string_view venue) -> BibliographyEntry&
{
    validate_text(venue, "A bibliography venue", false);
    venue_ = venue;
    return *this;
}

auto BibliographyEntry::set_publisher(const std::string_view publisher) -> BibliographyEntry&
{
    validate_text(publisher, "A bibliography publisher", false);
    publisher_ = publisher;
    return *this;
}

auto BibliographyEntry::set_doi(const std::string_view doi) -> BibliographyEntry&
{
    validate_link_value(doi, "A bibliography DOI");
    doi_ = doi;
    return *this;
}

auto BibliographyEntry::set_url(const std::string_view url) -> BibliographyEntry&
{
    validate_link_value(url, "A bibliography URL");
    url_ = url;
    return *this;
}

Citation::Citation(CitationKey key)
{
    keys_.push_back(std::move(key));
}

Citation::Citation(const std::initializer_list<CitationKey> keys) : keys_{keys}
{
    if (keys_.empty())
    {
        throw std::invalid_argument{"A citation requires at least one key"};
    }
    for (usize index{}; index < keys_.size(); ++index)
    {
        const auto duplicate = std::ranges::find_if(
            keys_.begin(),
            keys_.begin() + static_cast<std::ptrdiff_t>(index),
            [this, index](const CitationKey& key) { return key.value() == keys_[index].value(); }
        );
        if (duplicate != keys_.begin() + static_cast<std::ptrdiff_t>(index))
        {
            throw std::invalid_argument{"A citation must not repeat a key"};
        }
    }
}

auto Citation::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Citation::keys() const noexcept -> std::span<const CitationKey>
{
    return keys_;
}

auto Bibliography::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Bibliography::add_entry(
    CitationKey key,
    const BibliographyEntryKind kind,
    const std::string_view title,
    std::vector<std::string> authors
) -> BibliographyEntry&
{
    return add_entry(BibliographyEntry{std::move(key), kind, title, std::move(authors)});
}

auto Bibliography::add_entry(BibliographyEntry entry) -> BibliographyEntry&
{
    const auto duplicate = std::ranges::find_if(
        entries_,
        [&entry](const std::unique_ptr<BibliographyEntry>& existing)
        { return existing->key().value() == entry.key().value(); }
    );
    if (duplicate != entries_.end())
    {
        throw std::invalid_argument{
            "Duplicate bibliography key '" + std::string{entry.key().value()} + "'"
        };
    }

    auto stored_entry = std::make_unique<BibliographyEntry>(std::move(entry));
    auto& result = *stored_entry;
    entries_.push_back(std::move(stored_entry));
    return result;
}

auto Bibliography::entries() const noexcept -> std::span<const std::unique_ptr<BibliographyEntry>>
{
    return entries_;
}
}  // namespace dans::document::plugins
