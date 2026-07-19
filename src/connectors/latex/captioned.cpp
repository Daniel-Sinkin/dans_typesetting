// Share built-in LaTeX counters when possible and define injective custom counters otherwise.
#include "connectors/latex/captioned.hpp"

#include <stdexcept>
#include <string>
#include <utility>

namespace dans::document::connectors::latex
{
namespace
{
struct CounterDescriptor
{
    std::string name{};
    bool requires_definition{};
};

auto custom_counter_name(const std::string_view category) -> std::string
{
    constexpr std::string_view k_hex = "0123456789abcdef";
    std::string result{"danscaption"};
    result.reserve(result.size() + category.size() * usize{2});
    for (const char character : category)
    {
        const auto byte = static_cast<unsigned char>(character);
        result.push_back(k_hex[static_cast<usize>((byte >> 4U) & 0x0FU)]);
        result.push_back(k_hex[static_cast<usize>(byte & 0x0FU)]);
    }
    return result;
}

auto counter_for(const std::string_view category) -> CounterDescriptor
{
    if (category == "Figure")
    {
        return {.name = "figure", .requires_definition = false};
    }
    if (category == "Table")
    {
        return {.name = "table", .requires_definition = false};
    }
    if (category == "Listing")
    {
        return {.name = "lstlisting", .requires_definition = false};
    }
    if (category == "Equation")
    {
        return {.name = "equation", .requires_definition = false};
    }
    return {.name = custom_counter_name(category), .requires_definition = true};
}

auto require_single_content(const plugins::Captioned& captioned) -> void
{
    if (!captioned.has_content())
    {
        throw std::logic_error{"A Captioned block must own exactly one content block"};
    }
}
}  // namespace

CaptionedLatexAdapter::CaptionedLatexAdapter(
    std::shared_ptr<const InlineLatexRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A Captioned LaTeX adapter requires an inline renderer"};
    }
}

auto CaptionedLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Captioned::k_type_id;
}

auto CaptionedLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    const auto* captioned = dynamic_cast<const plugins::Captioned*>(&block);
    if (captioned == nullptr)
    {
        throw std::invalid_argument{"The Captioned adapter received a different block type"};
    }
    require_single_content(*captioned);
    output.write_raw("\\begin{samepage}\n");
    output.write_blocks(captioned->content());

    const auto has_caption = !captioned->caption().nodes().empty();
    if (!captioned->category().has_value() && !has_caption)
    {
        output.write_raw("\\end{samepage}\n\n");
        return;
    }

    output.write_raw("\\begin{center}\\small\\itshape\n");
    if (captioned->category().has_value())
    {
        const auto& category = captioned->category().value();
        const auto counter = counter_for(category);
        if (counter.requires_definition)
        {
            output.write_raw("\\makeatletter\\@ifundefined{c@");
            output.write_raw(counter.name);
            output.write_raw("}{\\newcounter{");
            output.write_raw(counter.name);
            output.write_raw(R"(}\expandafter\gdef\csname )");
            output.write_raw(counter.name);
            output.write_raw("autorefname\\endcsname{");
            output.write_text(category);
            output.write_raw("}}{}\\makeatother\n");
        }
        output.write_raw("\\refstepcounter{");
        output.write_raw(counter.name);
        output.write_raw("}");
        if (captioned->reference_id().has_value())
        {
            output.write_raw("\\label{");
            output.write_raw(captioned->reference_id().value().value());
            output.write_raw("}");
        }
        output.write_text(category);
        output.write_raw("~\\csname the");
        output.write_raw(counter.name);
        output.write_raw("\\endcsname");
        if (has_caption)
        {
            output.write_raw(": ");
        }
    }
    inline_renderer_->serialize(captioned->caption(), output);
    output.write_raw("\n\\end{center}\n\\end{samepage}\n\n");
}
}  // namespace dans::document::connectors::latex
