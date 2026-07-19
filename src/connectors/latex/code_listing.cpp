// src/connectors/latex/code_listing.cpp — render semantic source code through listings.
#include "connectors/latex/code_listing.hpp"

#include <stdexcept>
#include <utility>

namespace
{
auto latex_language(const dans::document::plugins::CodeLanguage language) -> std::string_view
{
    using dans::document::plugins::CodeLanguage;
    switch (language)
    {
        case CodeLanguage::cpp:
            return "C++";
        case CodeLanguage::cuda:
            return "CUDA";
        case CodeLanguage::julia:
            return "Julia";
        case CodeLanguage::raw:
            return {};
    }
    throw std::logic_error{"Unknown code-listing language"};
}
}  // namespace

namespace dans::document::connectors::latex
{
CodeListingLatexAdapter::CodeListingLatexAdapter(
    std::shared_ptr<const CoreParagraphInlineLatexRenderer> inline_renderer
)
    : inline_renderer_{std::move(inline_renderer)}
{
    if (inline_renderer_ == nullptr)
    {
        throw std::invalid_argument{"A code-listing LaTeX adapter requires an inline renderer"};
    }
}

auto CodeListingLatexAdapter::block_type_id() const noexcept -> std::string_view
{
    return plugins::CodeListing::k_type_id;
}

auto CodeListingLatexAdapter::serialize(
    const DocumentBlock& block, writers::LatexOutput& output
) const -> void
{
    const auto* listing = dynamic_cast<const plugins::CodeListing*>(&block);
    if (listing == nullptr)
    {
        throw std::invalid_argument{"The code-listing adapter received a different block type"};
    }
    if (listing->code().contains("\\end{lstlisting}"))
    {
        throw std::invalid_argument{"A code listing cannot contain the LaTeX listings terminator"};
    }

    // Listings only advances its counter when it makes a caption. Advance it
    // explicitly for captionless blocks so every writer derives the same
    // ordinal sequence, including for otherwise unnumbered raw snippets.
    if (!listing->has_caption())
    {
        output.write_raw("\\refstepcounter{lstlisting}\n");
        if (listing->reference_id().has_value())
        {
            output.write_raw("\\label{");
            output.write_raw(listing->reference_id()->value());
            output.write_raw("}\n");
        }
    }

    output.write_raw("\\begin{lstlisting}");
    auto has_option = false;
    const auto language = latex_language(listing->language());
    if (!language.empty() || listing->has_caption())
    {
        output.write_raw("[");
    }
    if (!language.empty())
    {
        output.write_raw("language={");
        output.write_raw(language);
        output.write_raw("}");
        has_option = true;
    }
    if (listing->has_caption())
    {
        if (has_option)
        {
            output.write_raw(",");
        }
        output.write_raw("caption={");
        inline_renderer_->serialize(listing->caption(), output);
        output.write_raw("}");
        if (listing->reference_id().has_value())
        {
            output.write_raw(",label={");
            output.write_raw(listing->reference_id()->value());
            output.write_raw("}");
        }
    }
    if (!language.empty() || listing->has_caption())
    {
        output.write_raw("]");
    }
    output.write_raw("\n");
    output.write_raw(listing->code());
    if (!listing->code().ends_with('\n'))
    {
        output.write_raw("\n");
    }
    output.write_raw("\\end{lstlisting}\n\n");
}
}  // namespace dans::document::connectors::latex
