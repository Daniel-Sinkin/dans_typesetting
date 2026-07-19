// src/plugins/bibliography.hpp — define semantic citations and reference records.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_BIBLIOGRAPHY_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_BIBLIOGRAPHY_HPP

#include "plugins/core_paragraph.hpp"

#include <initializer_list>
#include <memory>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <vector>

namespace dans::document::plugins
{
class CitationKey final
{
  public:
    explicit CitationKey(std::string_view value);

    [[nodiscard]] auto value() const noexcept -> std::string_view;

  private:
    std::string value_{};
};

enum class BibliographyEntryKind : u8
{
    article,
    book,
    proceedings,
    thesis,
    web,
    miscellaneous,
};

// One normalized reference record. BibTeX and JSON are optional adapters over
// this value rather than alternate document models.
class BibliographyEntry final
{
  public:
    BibliographyEntry(
        CitationKey key,
        BibliographyEntryKind kind,
        std::string_view title,
        std::vector<std::string> authors = {}
    );

    [[nodiscard]] auto key() const noexcept -> const CitationKey&;
    [[nodiscard]] auto kind() const noexcept -> BibliographyEntryKind;
    [[nodiscard]] auto title() const noexcept -> std::string_view;
    [[nodiscard]] auto authors() const noexcept -> std::span<const std::string>;
    [[nodiscard]] auto year() const noexcept -> const std::optional<u16>&;
    [[nodiscard]] auto venue() const noexcept -> std::string_view;
    [[nodiscard]] auto publisher() const noexcept -> std::string_view;
    [[nodiscard]] auto doi() const noexcept -> std::string_view;
    [[nodiscard]] auto url() const noexcept -> std::string_view;

    auto set_year(u16 year) noexcept -> BibliographyEntry&;
    auto set_venue(std::string_view venue) -> BibliographyEntry&;
    auto set_publisher(std::string_view publisher) -> BibliographyEntry&;
    auto set_doi(std::string_view doi) -> BibliographyEntry&;
    auto set_url(std::string_view url) -> BibliographyEntry&;

  private:
    CitationKey key_;
    BibliographyEntryKind kind_{};
    std::string title_{};
    std::vector<std::string> authors_{};
    std::optional<u16> year_{};
    std::string venue_{};
    std::string publisher_{};
    std::string doi_{};
    std::string url_{};
};

class Citation final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.bibliography.citation";

    explicit Citation(CitationKey key);
    Citation(std::initializer_list<CitationKey> keys);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto keys() const noexcept -> std::span<const CitationKey>;

  private:
    std::vector<CitationKey> keys_{};
};

// A references block owns normalized entries in their visible/citation-number
// order. Writers derive display numbers and links from this sequence.
class Bibliography final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.bibliography.references";

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    auto add_entry(
        CitationKey key,
        BibliographyEntryKind kind,
        std::string_view title,
        std::vector<std::string> authors = {}
    ) -> BibliographyEntry&;
    auto add_entry(BibliographyEntry entry) -> BibliographyEntry&;
    [[nodiscard]] auto entries() const noexcept
        -> std::span<const std::unique_ptr<BibliographyEntry>>;

  private:
    std::vector<std::unique_ptr<BibliographyEntry>> entries_{};
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_BIBLIOGRAPHY_HPP
