// src/connectors/tex_math_expression.hpp — expose shared TeX notation for structured math.
#ifndef DANS_TYPESETTING_SRC_CONNECTORS_TEX_MATH_EXPRESSION_HPP
#define DANS_TYPESETTING_SRC_CONNECTORS_TEX_MATH_EXPRESSION_HPP

#include "plugins/math.hpp"

#include <string>

namespace dans::document::connectors::tex
{
struct RenderOptions
{
    bool align_top_level_equality{};
};

[[nodiscard]] auto render_expression(const plugins::Math& expression, RenderOptions options = {})
    -> std::string;
}  // namespace dans::document::connectors::tex

#endif  // DANS_TYPESETTING_SRC_CONNECTORS_TEX_MATH_EXPRESSION_HPP
