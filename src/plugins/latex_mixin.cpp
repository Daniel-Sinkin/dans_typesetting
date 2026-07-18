#include "plugins/latex_mixin.hpp"

namespace dans::document::plugins
{
LatexBlock::LatexBlock(const std::string_view source) : source_{source}
{
}

auto LatexBlock::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto LatexBlock::source() const noexcept -> std::string_view
{
    return source_;
}

InlineLatex::InlineLatex(const std::string_view source) : source_{source}
{
}

auto InlineLatex::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto InlineLatex::source() const noexcept -> std::string_view
{
    return source_;
}
}  // namespace dans::document::plugins
