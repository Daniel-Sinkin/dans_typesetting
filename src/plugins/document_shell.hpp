// src/plugins/document_shell.hpp — ordinary document-shell block contracts.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_DOCUMENT_SHELL_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_DOCUMENT_SHELL_HPP

#include "document.hpp"

#include <string>
#include <string_view>

namespace dans::document::plugins
{
class TitlePage final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.document.title_page";

    TitlePage(std::string_view title, std::string_view author, std::string_view date);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto title() const noexcept -> std::string_view;
    [[nodiscard]] auto author() const noexcept -> std::string_view;
    [[nodiscard]] auto date() const noexcept -> std::string_view;

  private:
    std::string title_{};
    std::string author_{};
    std::string date_{};
};

class TableOfContents final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.document.table_of_contents";

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
};

class PageBreak final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.document.page_break";

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_DOCUMENT_SHELL_HPP
