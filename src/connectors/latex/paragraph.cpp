// src/connectors/latex/paragraph.cpp — render text and paragraphs as LaTeX.
#include "connectors/latex/paragraph.hpp"

#include <stdexcept>
#include <utility>

namespace dans::document::connectors::latex
{
ParagraphLatexAdapter::ParagraphLatexAdapter(
    std::shared_ptr<const InlineLatexRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A paragraph LaTeX adapter requires an inline renderer"};
    }
}

auto ParagraphLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::Paragraph::k_type_id;
}

auto ParagraphLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    const auto* paragraph = dynamic_cast<const plugins::Paragraph*>(&block);
    if (paragraph == nullptr)
    {
        throw std::invalid_argument{"The paragraph adapter received a different content type"};
    }
    inline_renderer_->serialize(paragraph->inlines(), output);
    output.write_raw("\n\n");
}

auto TextLatexAdapter::inline_type_id() const noexcept -> std::string_view
{
    return plugins::Text::k_type_id;
}

auto TextLatexAdapter::serialize(const plugins::InlineNode& node, InlineLatexOutput& output) const
    -> void
{
    const auto* text = dynamic_cast<const plugins::Text*>(&node);
    if (text == nullptr)
    {
        throw std::invalid_argument{"The text adapter received a different inline type"};
    }
    switch (text->style())
    {
        case plugins::TextStyle::normal:
            output.write_text(text->text());
            return;
        case plugins::TextStyle::bold:
            output.write_raw("\\textbf{");
            output.write_text(text->text());
            output.write_raw("}");
            return;
        case plugins::TextStyle::italic:
            output.write_raw("\\textit{");
            output.write_text(text->text());
            output.write_raw("}");
            return;
        case plugins::TextStyle::bold_italic:
            output.write_raw("\\textbf{\\textit{");
            output.write_text(text->text());
            output.write_raw("}}");
            return;
    }
    throw std::logic_error{"Unknown text style"};
}
}  // namespace dans::document::connectors::latex
