// src/connectors/markdown/code_listing.cpp — emit numbered fenced source blocks.
#include "connectors/markdown/code_listing.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>
#include <utility>

namespace dans::document::connectors::markdown
{
namespace
{
auto language_name(const plugins::CodeLanguage language) -> std::string_view
{
    switch (language)
    {
        case plugins::CodeLanguage::cpp:
            return "cpp";
        case plugins::CodeLanguage::cuda:
            return "cuda";
        case plugins::CodeLanguage::julia:
            return "julia";
        case plugins::CodeLanguage::raw:
            return {};
    }
    throw std::logic_error{"Unknown code-listing language"};
}

auto longest_fence_run(const std::string_view code) noexcept -> usize
{
    usize longest{};
    usize current{};
    for (const char character : code)
    {
        if (character == '`')
        {
            ++current;
            longest = std::max(longest, current);
        }
        else
        {
            current = 0;
        }
    }
    return longest;
}
}  // namespace

CodeListingMarkdownAdapter::CodeListingMarkdownAdapter(
    std::shared_ptr<const InlineMarkdownRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A code-listing Markdown adapter requires an inline renderer"};
    }
}

auto CodeListingMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::CodeListing::k_type_id;
}

auto CodeListingMarkdownAdapter::targets(const DocumentBlock& block) const
    -> std::vector<writers::MarkdownTargetDescriptor>
{
    const auto* listing = dynamic_cast<const plugins::CodeListing*>(&block);
    if (listing == nullptr)
    {
        throw std::invalid_argument{"The code-listing adapter received a different block type"};
    }
    return {{
        .reference_id = listing->reference_id().has_value() ? &*listing->reference_id() : nullptr,
        .label = "Listing",
        .numbering_series = "listing",
    }};
}

auto CodeListingMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* listing = dynamic_cast<const plugins::CodeListing*>(&block);
    if (listing == nullptr)
    {
        throw std::invalid_argument{"The code-listing adapter received a different block type"};
    }
    if (listing->reference_id().has_value())
    {
        output.write_anchor(*listing->reference_id());
    }
    if (listing->has_caption())
    {
        output.write_raw("**Listing ");
        output.write_raw(output.target_number(block));
        output.write_raw(":** ");
        output.write_raw(inline_renderer_->render(listing->caption(), output));
        output.write_raw("\n\n");
    }
    const auto fence_length = std::max(usize{3}, longest_fence_run(listing->code()) + usize{1});
    const auto fence = std::string(fence_length, '`');
    output.write_raw(fence);
    output.write_raw(language_name(listing->language()));
    output.write_raw("\n");
    output.write_raw(listing->code());
    if (!listing->code().ends_with('\n'))
    {
        output.write_raw("\n");
    }
    output.write_raw(fence);
    output.write_raw("\n\n");
}
}  // namespace dans::document::connectors::markdown
