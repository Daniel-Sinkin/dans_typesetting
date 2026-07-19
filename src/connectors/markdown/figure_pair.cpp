// src/connectors/markdown/figure_pair.cpp — emit a portable two-column figure table.
#include "connectors/markdown/figure_pair.hpp"

#include <array>
#include <stdexcept>
#include <utility>

namespace dans::document::connectors::markdown
{
FigurePairMarkdownAdapter::FigurePairMarkdownAdapter(
    std::shared_ptr<const InlineMarkdownRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A figure-pair Markdown adapter requires an inline renderer"};
    }
}

auto FigurePairMarkdownAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::FigurePair::k_type_id;
}

auto FigurePairMarkdownAdapter::targets(const DocumentBlock& block) const
    -> std::vector<writers::MarkdownTargetDescriptor>
{
    const auto* figure = dynamic_cast<const plugins::FigurePair*>(&block);
    if (figure == nullptr)
    {
        throw std::invalid_argument{"The figure-pair adapter received a different block type"};
    }

    std::vector<writers::MarkdownTargetDescriptor> result{{
        .reference_id =
            figure->reference_id().has_value() ? &figure->reference_id().value() : nullptr,
        .label = "Figure",
        .numbering_series = "Figure",
    }};
    constexpr std::array<std::string_view, 2> k_suffixes{"a", "b"};
    const auto panels = figure->panels();
    for (usize index{}; index < panels.size(); ++index)
    {
        const auto& reference_id = panels[index].reference_id();
        if (reference_id.has_value())
        {
            result.push_back(
                writers::MarkdownTargetDescriptor{
                    .reference_id = &reference_id.value(),
                    .label = "Figure",
                    .numbering_series = "Figure",
                    .advances_numbering = false,
                    .number_suffix = k_suffixes[index],
                }
            );
        }
    }
    return result;
}

auto FigurePairMarkdownAdapter::serialize(
    const DocumentBlock& block, writers::MarkdownOutput& output
) const -> void
{
    const auto* figure = dynamic_cast<const plugins::FigurePair*>(&block);
    if (figure == nullptr)
    {
        throw std::invalid_argument{"The figure-pair adapter received a different block type"};
    }

    const auto panels = figure->panels();
    std::array<std::string, 2> captions{};
    for (usize index{}; index < panels.size(); ++index)
    {
        captions[index] = inline_renderer_->render(panels[index].caption(), output);
    }
    const auto group_caption = inline_renderer_->render(figure->caption(), output);

    if (figure->reference_id().has_value())
    {
        output.write_anchor(figure->reference_id().value());
    }
    for (const auto& panel : panels)
    {
        const auto& reference_id = panel.reference_id();
        if (reference_id.has_value())
        {
            output.write_anchor(reference_id.value());
        }
    }
    output.write_raw("\n");
    output.write_raw("| ![](");
    output.write_raw(
        writers::markdown_link_destination(panels[0].source().path().generic_string())
    );
    output.write_raw(") | ![](");
    output.write_raw(
        writers::markdown_link_destination(panels[1].source().path().generic_string())
    );
    output.write_raw(") |\n|:--:|:--:|\n| *(a) ");
    output.write_raw(captions[0]);
    output.write_raw("* | *(b) ");
    output.write_raw(captions[1]);
    output.write_raw("* |\n\n*Figure ");
    output.write_raw(output.target_number(block));
    output.write_raw(": ");
    output.write_raw(group_caption);
    output.write_raw("*\n\n");
}
}  // namespace dans::document::connectors::markdown
