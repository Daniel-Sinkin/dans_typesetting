// Parse and write a deliberately small, deterministic BibTeX subset.
#include "plugins/bibliography_bibtex.hpp"

#include <charconv>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

namespace
{
using dans::usize;
using dans::document::plugins::BibliographyEntry;
using dans::document::plugins::BibliographyEntryKind;
using dans::document::plugins::CitationKey;

[[nodiscard]] auto is_space(const char character) noexcept -> bool
{
    return character == ' ' || character == '\t' || character == '\r' || character == '\n';
}

[[nodiscard]] auto is_identifier_character(const char character) noexcept -> bool
{
    return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z')
           || (character >= '0' && character <= '9') || character == '_' || character == '-';
}

[[nodiscard]] auto is_digit(const char character) noexcept -> bool
{
    return character >= '0' && character <= '9';
}

[[nodiscard]] auto ascii_lower(std::string value) -> std::string
{
    for (char& character : value)
    {
        if (character >= 'A' && character <= 'Z')
        {
            character = static_cast<char>(character - 'A' + 'a');
        }
    }
    return value;
}

[[nodiscard]] auto trim(const std::string_view value) -> std::string
{
    auto begin = usize{};
    while (begin < value.size() && is_space(value[begin]))
    {
        ++begin;
    }
    auto end = value.size();
    while (end > begin && is_space(value[end - usize{1}]))
    {
        --end;
    }
    return std::string{value.substr(begin, end - begin)};
}

[[nodiscard]] auto strip_grouping(const std::string_view value) -> std::string
{
    std::string result{};
    result.reserve(value.size());
    for (const char character : value)
    {
        if (character != '{' && character != '}')
        {
            result.push_back(character);
        }
    }
    return result;
}

[[nodiscard]] auto split_authors(const std::string_view source) -> std::vector<std::string>
{
    std::vector<std::string> result{};
    auto segment_begin = usize{};
    auto position = usize{};
    while (position < source.size())
    {
        if (!is_space(source[position]))
        {
            ++position;
            continue;
        }
        auto word_begin = position;
        while (word_begin < source.size() && is_space(source[word_begin]))
        {
            ++word_begin;
        }
        if (word_begin + usize{3} > source.size()
            || ascii_lower(std::string{source.substr(word_begin, usize{3})}) != "and")
        {
            position = word_begin;
            continue;
        }
        const auto word_end = word_begin + usize{3};
        if (word_end >= source.size() || !is_space(source[word_end]))
        {
            position = word_end;
            continue;
        }
        auto next_begin = word_end;
        while (next_begin < source.size() && is_space(source[next_begin]))
        {
            ++next_begin;
        }
        auto author = strip_grouping(trim(source.substr(segment_begin, position - segment_begin)));
        if (!author.empty())
        {
            result.push_back(std::move(author));
        }
        segment_begin = next_begin;
        position = next_begin;
    }
    auto final_author = strip_grouping(trim(source.substr(segment_begin)));
    if (!final_author.empty())
    {
        result.push_back(std::move(final_author));
    }
    return result;
}

class BibtexParser final
{
  public:
    explicit BibtexParser(const std::string_view source) noexcept : source_{source}
    {
    }

    [[nodiscard]] auto parse() -> std::vector<BibliographyEntry>
    {
        std::vector<BibliographyEntry> entries{};
        std::unordered_set<std::string> keys{};
        skip_space();
        while (!at_end())
        {
            expect('@');
            const auto raw_kind = ascii_lower(identifier());
            skip_space();
            const auto opening = take();
            if (opening != '{' && opening != '(')
            {
                fail("Expected '{' or '(' after an entry type");
            }
            const auto closing = opening == '{' ? '}' : ')';
            if (raw_kind == "comment")
            {
                skip_balanced(opening, closing);
                skip_space();
                continue;
            }
            if (raw_kind == "string" || raw_kind == "preamble")
            {
                fail("BibTeX string macros and preambles are not supported");
            }

            skip_space();
            const auto key_begin = position_;
            while (!at_end() && peek() != ',' && peek() != closing)
            {
                ++position_;
            }
            const auto key = trim(source_.substr(key_begin, position_ - key_begin));
            if (at_end() || peek() != ',')
            {
                fail("A BibTeX entry requires a key followed by fields");
            }
            ++position_;
            std::unordered_map<std::string, std::string> fields{};
            skip_space();
            while (peek() != closing)
            {
                const auto field = ascii_lower(identifier());
                skip_space();
                expect('=');
                skip_space();
                auto field_value = value(closing);
                skip_space();
                if (!at_end() && peek() == '#')
                {
                    fail("BibTeX value concatenation is not supported");
                }
                if (!fields.emplace(field, std::move(field_value)).second)
                {
                    fail("Duplicate BibTeX field '" + field + "'");
                }
                skip_space();
                if (peek() == ',')
                {
                    ++position_;
                    skip_space();
                    if (peek() == closing)
                    {
                        break;
                    }
                }
                else if (peek() != closing)
                {
                    fail("Expected ',' or the end of a BibTeX entry");
                }
            }
            expect(closing);
            auto entry = lower_entry(raw_kind, key, fields);
            if (!keys.emplace(entry.key().value()).second)
            {
                fail("Duplicate bibliography key '" + std::string{entry.key().value()} + "'");
            }
            entries.push_back(std::move(entry));
            skip_space();
        }
        return entries;
    }

  private:
    [[noreturn]] auto fail(const std::string_view message) const -> void
    {
        throw std::invalid_argument{
            "Invalid BibTeX at byte " + std::to_string(position_) + ": " + std::string{message}
        };
    }

    [[nodiscard]] auto kind(const std::string_view value) const -> BibliographyEntryKind
    {
        if (value == "article")
        {
            return BibliographyEntryKind::article;
        }
        if (value == "book" || value == "inbook")
        {
            return BibliographyEntryKind::book;
        }
        if (value == "inproceedings" || value == "conference")
        {
            return BibliographyEntryKind::proceedings;
        }
        if (value == "phdthesis" || value == "mastersthesis")
        {
            return BibliographyEntryKind::thesis;
        }
        if (value == "online" || value == "www")
        {
            return BibliographyEntryKind::web;
        }
        if (value == "misc")
        {
            return BibliographyEntryKind::miscellaneous;
        }
        fail("Unsupported BibTeX entry type '" + std::string{value} + "'");
    }

    [[nodiscard]] auto field(
        const std::unordered_map<std::string, std::string>& fields, const std::string_view name
    ) const -> std::string
    {
        const auto found = fields.find(std::string{name});
        return found == fields.end() ? std::string{} : strip_grouping(found->second);
    }

    [[nodiscard]] auto lower_entry(
        const std::string_view raw_kind,
        const std::string_view key,
        const std::unordered_map<std::string, std::string>& fields
    ) const -> BibliographyEntry
    {
        const auto title = field(fields, "title");
        if (title.empty())
        {
            fail("BibTeX entry '" + std::string{key} + "' requires a title field");
        }
        for (const auto& [name, field_value] : fields)
        {
            static_cast<void>(name);
            if (field_value.contains('\\'))
            {
                fail(
                    "LaTeX commands inside BibTeX values are not supported; import normalized "
                    "UTF-8 text"
                );
            }
        }

        BibliographyEntry entry{
            CitationKey{key}, kind(raw_kind), title, split_authors(field(fields, "author"))
        };
        const auto year_source = field(fields, "year");
        if (!year_source.empty())
        {
            dans::u16 year{};
            const auto [end, error] =
                std::from_chars(year_source.data(), year_source.data() + year_source.size(), year);
            if (error != std::errc{} || end != year_source.data() + year_source.size())
            {
                fail("BibTeX entry '" + std::string{key} + "' has a non-numeric year");
            }
            entry.set_year(year);
        }

        auto venue = field(fields, "journal");
        if (venue.empty())
        {
            venue = field(fields, "booktitle");
        }
        if (venue.empty())
        {
            venue = field(fields, "school");
        }
        if (venue.empty())
        {
            venue = field(fields, "howpublished");
        }
        auto publisher = field(fields, "publisher");
        if (publisher.empty())
        {
            publisher = field(fields, "institution");
        }
        entry.set_venue(venue)
            .set_publisher(publisher)
            .set_doi(field(fields, "doi"))
            .set_url(field(fields, "url"));
        return entry;
    }

    [[nodiscard]] auto value(const char closing) -> std::string
    {
        if (peek() == '{')
        {
            return braced_value();
        }
        if (peek() == '"')
        {
            return quoted_value();
        }
        const auto begin = position_;
        while (!at_end() && peek() != ',' && peek() != closing)
        {
            if (peek() == '#')
            {
                fail("BibTeX value concatenation is not supported");
            }
            ++position_;
        }
        auto result = trim(source_.substr(begin, position_ - begin));
        if (result.empty())
        {
            fail("BibTeX field values must not be empty");
        }
        for (const char character : result)
        {
            if (!is_digit(character))
            {
                fail(
                    "Bare BibTeX string macros are not supported; use a braced or quoted UTF-8 "
                    "value"
                );
            }
        }
        return result;
    }

    [[nodiscard]] auto braced_value() -> std::string
    {
        expect('{');
        auto depth = usize{1};
        std::string result{};
        while (!at_end())
        {
            const auto character = take();
            if (character == '{')
            {
                ++depth;
                result.push_back(character);
            }
            else if (character == '}')
            {
                --depth;
                if (depth == 0)
                {
                    return result;
                }
                result.push_back(character);
            }
            else
            {
                result.push_back(character);
            }
        }
        fail("Unterminated braced BibTeX value");
    }

    [[nodiscard]] auto quoted_value() -> std::string
    {
        expect('"');
        auto brace_depth = usize{};
        std::string result{};
        while (!at_end())
        {
            const auto character = take();
            if (character == '{')
            {
                ++brace_depth;
            }
            else if (character == '}')
            {
                if (brace_depth == 0)
                {
                    fail("Unbalanced brace in quoted BibTeX value");
                }
                --brace_depth;
            }
            else if (character == '"' && brace_depth == 0)
            {
                return result;
            }
            result.push_back(character);
        }
        fail("Unterminated quoted BibTeX value");
    }

    auto skip_balanced(const char opening, const char closing) -> void
    {
        auto depth = usize{1};
        while (!at_end())
        {
            const auto character = take();
            if (character == opening)
            {
                ++depth;
            }
            else if (character == closing)
            {
                --depth;
                if (depth == 0)
                {
                    return;
                }
            }
        }
        fail("Unterminated BibTeX comment");
    }

    [[nodiscard]] auto identifier() -> std::string
    {
        skip_space();
        const auto begin = position_;
        while (!at_end() && is_identifier_character(peek()))
        {
            ++position_;
        }
        if (begin == position_)
        {
            fail("Expected a BibTeX identifier");
        }
        return std::string{source_.substr(begin, position_ - begin)};
    }

    auto skip_space() -> void
    {
        while (!at_end())
        {
            if (is_space(peek()))
            {
                ++position_;
            }
            else if (peek() == '%')
            {
                while (!at_end() && peek() != '\n')
                {
                    ++position_;
                }
            }
            else
            {
                return;
            }
        }
    }

    auto expect(const char expected) -> void
    {
        if (take() != expected)
        {
            fail("Expected a different delimiter");
        }
    }

    [[nodiscard]] auto peek() const -> char
    {
        if (at_end())
        {
            fail("Unexpected end of BibTeX input");
        }
        return source_[position_];
    }

    [[nodiscard]] auto take() -> char
    {
        const auto result = peek();
        ++position_;
        return result;
    }

    [[nodiscard]] auto at_end() const noexcept -> bool
    {
        return position_ >= source_.size();
    }

    std::string_view source_{};
    usize position_{};
};

[[nodiscard]] auto bibtex_kind(const BibliographyEntryKind kind) -> std::string_view
{
    switch (kind)
    {
        case BibliographyEntryKind::article:
            return "article";
        case BibliographyEntryKind::book:
            return "book";
        case BibliographyEntryKind::proceedings:
            return "inproceedings";
        case BibliographyEntryKind::thesis:
            return "phdthesis";
        case BibliographyEntryKind::web:
            return "online";
        case BibliographyEntryKind::miscellaneous:
            return "misc";
    }
    throw std::logic_error{"Unhandled bibliography entry kind"};
}

[[nodiscard]] auto bibtex_value(const std::string_view value, const std::string_view context)
    -> std::string
{
    if (value.find_first_of("{}\\\r\n") != std::string_view::npos)
    {
        throw std::invalid_argument{
            std::string{context}
            + " contains braces, backslashes, or line breaks not supported by the BibTeX projection"
        };
    }
    return "{" + std::string{value} + "}";
}

[[nodiscard]] auto join_authors(const BibliographyEntry& entry) -> std::string
{
    std::string result{};
    for (usize index{}; index < entry.authors().size(); ++index)
    {
        if (index != 0)
        {
            result.append(" and ");
        }
        result.append(entry.authors()[index]);
    }
    return result;
}

[[nodiscard]] auto read_file(const std::filesystem::path& path) -> std::string
{
    std::ifstream input{path, std::ios::binary};
    if (!input)
    {
        throw std::runtime_error{"Could not open bibliography input: " + path.string()};
    }
    std::ostringstream buffer{};
    buffer << input.rdbuf();
    if (!input.eof() && input.fail())
    {
        throw std::runtime_error{"Could not read bibliography input: " + path.string()};
    }
    return buffer.str();
}

auto write_file(const std::filesystem::path& path, const std::string_view source) -> void
{
    std::ofstream output{path, std::ios::binary | std::ios::trunc};
    if (!output)
    {
        throw std::runtime_error{"Could not open bibliography output: " + path.string()};
    }
    output << source;
    output.flush();
    if (!output)
    {
        throw std::runtime_error{"Could not write bibliography output: " + path.string()};
    }
}
}  // namespace

namespace dans::document::plugins
{
auto parse_bibliography_bibtex(const std::string_view source) -> std::vector<BibliographyEntry>
{
    return BibtexParser{source}.parse();
}

auto serialize_bibliography_bibtex(const Bibliography& bibliography) -> std::string
{
    std::string output{};
    for (usize entry_index{}; entry_index < bibliography.entries().size(); ++entry_index)
    {
        const auto& entry = *bibliography.entries()[entry_index];
        if (entry_index != 0)
        {
            output.push_back('\n');
        }
        output.append("@");
        output.append(bibtex_kind(entry.kind()));
        output.push_back('{');
        output.append(entry.key().value());
        output.append(",\n");

        std::vector<std::pair<std::string_view, std::string>> fields{};
        if (!entry.authors().empty())
        {
            fields.emplace_back("author", join_authors(entry));
        }
        fields.emplace_back("title", entry.title());
        if (entry.year().has_value())
        {
            fields.emplace_back("year", std::to_string(*entry.year()));
        }
        if (!entry.venue().empty())
        {
            auto venue_field = std::string_view{"howpublished"};
            if (entry.kind() == BibliographyEntryKind::article)
            {
                venue_field = "journal";
            }
            else if (entry.kind() == BibliographyEntryKind::proceedings)
            {
                venue_field = "booktitle";
            }
            else if (entry.kind() == BibliographyEntryKind::thesis)
            {
                venue_field = "school";
            }
            fields.emplace_back(venue_field, entry.venue());
        }
        if (!entry.publisher().empty())
        {
            fields.emplace_back("publisher", entry.publisher());
        }
        if (!entry.doi().empty())
        {
            fields.emplace_back("doi", entry.doi());
        }
        if (!entry.url().empty())
        {
            fields.emplace_back("url", entry.url());
        }
        for (usize field_index{}; field_index < fields.size(); ++field_index)
        {
            const auto& [name, value] = fields[field_index];
            output.append("  ");
            output.append(name);
            output.append(" = ");
            output.append(
                bibtex_value(value, std::string{entry.key().value()} + "." + std::string{name})
            );
            output.append(field_index + usize{1} == fields.size() ? "\n" : ",\n");
        }
        output.append("}\n");
    }
    return output;
}

auto import_bibliography_bibtex(Bibliography& bibliography, const std::string_view source) -> void
{
    if (!bibliography.entries().empty())
    {
        throw std::invalid_argument{"BibTeX import requires an empty bibliography destination"};
    }
    auto entries = parse_bibliography_bibtex(source);
    for (auto& entry : entries)
    {
        bibliography.add_entry(std::move(entry));
    }
}

auto import_bibliography_bibtex_file(Bibliography& bibliography, const std::filesystem::path& path)
    -> void
{
    import_bibliography_bibtex(bibliography, read_file(path));
}

auto write_bibliography_bibtex_file(
    const Bibliography& bibliography, const std::filesystem::path& path
) -> void
{
    write_file(path, serialize_bibliography_bibtex(bibliography));
}
}  // namespace dans::document::plugins
