// Validate Captioned's category identity and expose its single content endpoint.
#include "plugins/captioned.hpp"

#include "plugins/text.hpp"

#include <cctype>
#include <stdexcept>
#include <utility>

namespace dans::document::plugins
{
namespace
{
auto validate_category(const std::string_view category) -> void
{
    if (category.empty() || std::isspace(static_cast<unsigned char>(category.front())) != 0
        || std::isspace(static_cast<unsigned char>(category.back())) != 0)
    {
        throw std::invalid_argument{"A numbering category must be non-empty and trimmed"};
    }
    for (const char character : category)
    {
        const auto value = static_cast<unsigned char>(character);
        if (value < 0x20U || value == 0x7FU)
        {
            throw std::invalid_argument{"A numbering category cannot contain control characters"};
        }
    }
}
}  // namespace

Captioned::Captioned(
    const std::string_view category,
    const std::string_view caption,
    std::optional<ReferenceId> reference_id
)
    : category_{std::string{category}}, reference_id_{std::move(reference_id)}
{
    validate_category(category);
    if (!caption.empty())
    {
        caption_.add<Text>(caption);
    }
}

Captioned::Captioned(std::nullopt_t, const std::string_view caption)
{
    if (!caption.empty())
    {
        caption_.add<Text>(caption);
    }
}

auto Captioned::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Captioned::child_sequence_count() const noexcept -> usize
{
    return 1;
}

auto Captioned::child_sequence_id(const usize index) const -> std::string_view
{
    if (index != 0)
    {
        throw std::out_of_range{"Captioned exposes only its content child sequence"};
    }
    return k_content_sequence_id;
}

auto Captioned::child_sequence(const usize index) const -> const BlockSequence&
{
    if (index != 0)
    {
        throw std::out_of_range{"Captioned exposes only its content child sequence"};
    }
    return content_;
}

auto Captioned::category() const noexcept -> const std::optional<std::string>&
{
    return category_;
}

auto Captioned::reference_id() const noexcept -> const std::optional<ReferenceId>&
{
    return reference_id_;
}

auto Captioned::caption() noexcept -> InlineSequence&
{
    return caption_;
}

auto Captioned::caption() const noexcept -> const InlineSequence&
{
    return caption_;
}

auto Captioned::content() const noexcept -> const BlockSequence&
{
    return content_;
}

auto Captioned::has_content() const noexcept -> bool
{
    return content_.blocks().size() == usize{1};
}
}  // namespace dans::document::plugins
