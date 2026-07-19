// src/plugins/document_shell.cpp — validate ordinary document-shell blocks.
#include "plugins/document_shell.hpp"

#include <stdexcept>

namespace dans::document::plugins
{
TitlePage::TitlePage(
    const std::string_view title, const std::string_view author, const std::string_view date
)
    : title_{title}, author_{author}, date_{date}
{
    if (title.empty() || author.empty() || date.empty())
    {
        throw std::invalid_argument{"A title page requires a title, author, and date"};
    }
}

auto TitlePage::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto TitlePage::title() const noexcept -> std::string_view
{
    return title_;
}

auto TitlePage::author() const noexcept -> std::string_view
{
    return author_;
}

auto TitlePage::date() const noexcept -> std::string_view
{
    return date_;
}

auto TableOfContents::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto PageBreak::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}
}  // namespace dans::document::plugins
