// Parse and write the versioned bibliography JSON projection.
#include "plugins/bibliography_json.hpp"

#include "transport/json.hpp"

#include <charconv>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_set>
#include <utility>

namespace
{
using dans::document::plugins::BibliographyEntry;
using dans::document::plugins::BibliographyEntryKind;
using dans::document::plugins::CitationKey;
using dans::document::transport::JsonNumber;
using dans::document::transport::JsonValue;

[[nodiscard]] auto require_object(const JsonValue& value, const std::string_view context)
    -> const JsonValue::Object&
{
    if (!value.is_object())
    {
        throw std::invalid_argument{std::string{context} + " must be an object"};
    }
    return value.as_object();
}

[[nodiscard]] auto require_array(const JsonValue& value, const std::string_view context)
    -> const JsonValue::Array&
{
    if (!value.is_array())
    {
        throw std::invalid_argument{std::string{context} + " must be an array"};
    }
    return value.as_array();
}

[[nodiscard]] auto find_member(
    const JsonValue::Object& object, const std::string_view field, const std::string_view context
) -> const JsonValue&
{
    for (const auto& [name, value] : object)
    {
        if (name == field)
        {
            return value;
        }
    }
    throw std::invalid_argument{
        std::string{context} + " requires a '" + std::string{field} + "' field"
    };
}

[[nodiscard]] auto require_string(const JsonValue& value, const std::string_view context)
    -> std::string
{
    if (!value.is_string())
    {
        throw std::invalid_argument{std::string{context} + " must be a string"};
    }
    return std::string{value.as_string()};
}

[[nodiscard]] auto optional_string(const JsonValue& value, const std::string_view context)
    -> std::string
{
    if (value.is_null())
    {
        return {};
    }
    return require_string(value, context);
}

[[nodiscard]] auto require_u32(const JsonValue& value, const std::string_view context) -> dans::u32
{
    if (!value.is_number())
    {
        throw std::invalid_argument{std::string{context} + " must be an unsigned integer"};
    }
    const auto source = value.as_number().lexeme();
    dans::u32 result{};
    const auto [end, error] =
        std::from_chars(source.data(), source.data() + source.size(), result);
    if (error != std::errc{} || end != source.data() + source.size())
    {
        throw std::invalid_argument{std::string{context} + " must be an unsigned integer"};
    }
    return result;
}

[[nodiscard]] auto parse_kind(const std::string_view value) -> BibliographyEntryKind
{
    if (value == "article")
    {
        return BibliographyEntryKind::article;
    }
    if (value == "book")
    {
        return BibliographyEntryKind::book;
    }
    if (value == "proceedings")
    {
        return BibliographyEntryKind::proceedings;
    }
    if (value == "thesis")
    {
        return BibliographyEntryKind::thesis;
    }
    if (value == "web")
    {
        return BibliographyEntryKind::web;
    }
    if (value == "miscellaneous")
    {
        return BibliographyEntryKind::miscellaneous;
    }
    throw std::invalid_argument{"Bibliography JSON entry kind is invalid"};
}

[[nodiscard]] auto kind_name(const BibliographyEntryKind kind) -> std::string
{
    switch (kind)
    {
        case BibliographyEntryKind::article:
            return "article";
        case BibliographyEntryKind::book:
            return "book";
        case BibliographyEntryKind::proceedings:
            return "proceedings";
        case BibliographyEntryKind::thesis:
            return "thesis";
        case BibliographyEntryKind::web:
            return "web";
        case BibliographyEntryKind::miscellaneous:
            return "miscellaneous";
    }
    throw std::logic_error{"Unhandled bibliography entry kind"};
}

[[nodiscard]] auto nullable_string(const std::string_view value) -> JsonValue
{
    return value.empty() ? JsonValue{} : JsonValue{std::string{value}};
}

[[nodiscard]] auto parse_entry(const JsonValue& value, const dans::usize index)
    -> BibliographyEntry
{
    const auto context = "Bibliography JSON entry " + std::to_string(index);
    const auto& object = require_object(value, context);
    const auto& author_values =
        require_array(find_member(object, "authors", context), context + ".authors");
    std::vector<std::string> authors{};
    authors.reserve(author_values.size());
    for (const auto& author : author_values)
    {
        authors.push_back(require_string(author, context + ".authors[]"));
    }

    BibliographyEntry entry{
        CitationKey{require_string(find_member(object, "key", context), context + ".key")},
        parse_kind(require_string(find_member(object, "kind", context), context + ".kind")),
        require_string(find_member(object, "title", context), context + ".title"),
        std::move(authors),
    };
    const auto& year = find_member(object, "year", context);
    if (!year.is_null())
    {
        const auto parsed_year = require_u32(year, context + ".year");
        if (parsed_year > 65'535U)
        {
            throw std::invalid_argument{context + ".year exceeds an unsigned 16-bit integer"};
        }
        entry.set_year(static_cast<dans::u16>(parsed_year));
    }

    const auto venue =
        optional_string(find_member(object, "venue", context), context + ".venue");
    const auto publisher =
        optional_string(find_member(object, "publisher", context), context + ".publisher");
    const auto doi = optional_string(find_member(object, "doi", context), context + ".doi");
    const auto url = optional_string(find_member(object, "url", context), context + ".url");
    entry.set_venue(venue).set_publisher(publisher).set_doi(doi).set_url(url);
    return entry;
}

[[nodiscard]] auto entry_to_json(const BibliographyEntry& entry) -> JsonValue
{
    JsonValue::Array authors{};
    authors.reserve(entry.authors().size());
    for (const auto& author : entry.authors())
    {
        authors.emplace_back(author);
    }
    const auto year = entry.year().has_value()
                          ? JsonValue{JsonNumber{std::to_string(*entry.year())}}
                          : JsonValue{};
    return JsonValue{JsonValue::Object{
        {"key", JsonValue{std::string{entry.key().value()}}},
        {"kind", JsonValue{kind_name(entry.kind())}},
        {"title", JsonValue{std::string{entry.title()}}},
        {"authors", JsonValue{std::move(authors)}},
        {"year", year},
        {"venue", nullable_string(entry.venue())},
        {"publisher", nullable_string(entry.publisher())},
        {"doi", nullable_string(entry.doi())},
        {"url", nullable_string(entry.url())},
    }};
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
auto parse_bibliography_json(const std::string_view source) -> std::vector<BibliographyEntry>
{
    const auto root = transport::JsonValue::parse(source);
    const auto& object = require_object(root, "Bibliography JSON");
    const auto format =
        require_string(find_member(object, "format", "Bibliography JSON"), "Bibliography format");
    const auto schema_version = require_u32(
        find_member(object, "schemaVersion", "Bibliography JSON"),
        "Bibliography schemaVersion"
    );
    if (format != k_bibliography_json_format
        || schema_version != k_bibliography_json_schema_version)
    {
        throw std::invalid_argument{"Unsupported bibliography JSON format or schema version"};
    }

    const auto& values =
        require_array(find_member(object, "entries", "Bibliography JSON"), "Bibliography entries");
    std::vector<BibliographyEntry> entries{};
    entries.reserve(values.size());
    std::unordered_set<std::string> keys{};
    for (usize index{}; index < values.size(); ++index)
    {
        auto entry = parse_entry(values[index], index);
        if (!keys.emplace(entry.key().value()).second)
        {
            throw std::invalid_argument{
                "Duplicate bibliography key '" + std::string{entry.key().value()} + "'"
            };
        }
        entries.push_back(std::move(entry));
    }
    return entries;
}

auto serialize_bibliography_json(const Bibliography& bibliography) -> std::string
{
    transport::JsonValue::Array entries{};
    entries.reserve(bibliography.entries().size());
    for (const auto& entry : bibliography.entries())
    {
        entries.push_back(entry_to_json(*entry));
    }
    const auto root = transport::JsonValue{transport::JsonValue::Object{
        {"format", transport::JsonValue{std::string{k_bibliography_json_format}}},
        {"schemaVersion",
         transport::JsonValue{
             transport::JsonNumber{std::to_string(k_bibliography_json_schema_version)}
         }},
        {"entries", transport::JsonValue{std::move(entries)}},
    }};
    return root.to_pretty_string() + '\n';
}

auto import_bibliography_json(Bibliography& bibliography, const std::string_view source) -> void
{
    if (!bibliography.entries().empty())
    {
        throw std::invalid_argument{"Bibliography JSON import requires an empty destination"};
    }
    auto entries = parse_bibliography_json(source);
    for (auto& entry : entries)
    {
        bibliography.add_entry(std::move(entry));
    }
}

auto import_bibliography_json_file(
    Bibliography& bibliography, const std::filesystem::path& path
) -> void
{
    import_bibliography_json(bibliography, read_file(path));
}

auto write_bibliography_json_file(
    const Bibliography& bibliography, const std::filesystem::path& path
) -> void
{
    write_file(path, serialize_bibliography_json(bibliography));
}
}  // namespace dans::document::plugins
