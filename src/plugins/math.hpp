// src/plugins/math.hpp — define the structured-math value and its document hosts.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_MATH_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_MATH_HPP

#include "plugins/core_paragraph.hpp"
#include "reference_id.hpp"

#include <memory>
#include <optional>
#include <span>
#include <string_view>
#include <vector>

namespace dans::document::plugins
{
// A deliberately small, backend-independent presentation tree. It preserves
// notation and grouping for exporters but does not define evaluation semantics.
// The fluent mutators build ordinary structured data; exporters inspect that
// data through the read-only API below.
class Math final
{
  public:
    enum class Symbol : u8
    {
        alpha,
        beta,
        theta,
        psi,
        nabla,
        asterisk,
    };

    enum class BinaryOperator : u8
    {
        add,
        subtract,
        equal,
        product,
        center_dot,
        times,
    };

    enum class Delimiter : u8
    {
        parentheses,
        square,
        angle,
    };

    enum class DisplayAlignment : u8
    {
        automatic,
        disabled,
    };

    struct DisplayOptions
    {
        DisplayAlignment alignment{DisplayAlignment::automatic};
    };

    struct BinaryExpression;
    struct DisplayLine;
    class Display;
    class Inline;

    enum class Kind : u8
    {
        integer,
        identifier,
        symbol,
        binary,
        script,
        sequence,
        function,
        delimited,
        inner_product,
        summation,
    };

    ~Math();
    Math(Math&& other) noexcept;
    auto operator=(Math&& other) noexcept -> Math&;

    Math(const Math&) = delete;
    auto operator=(const Math&) -> Math& = delete;

    [[nodiscard]] static auto integer(i64 value) -> Math;
    [[nodiscard]] static auto identifier(std::string_view name) -> Math;
    [[nodiscard]] static auto symbol(Symbol symbol) -> Math;
    [[nodiscard]] static auto binary(Math left, BinaryOperator operation, Math right) -> Math;
    [[nodiscard]] static auto add(Math left, Math right) -> Math;
    [[nodiscard]] static auto subtract(Math left, Math right) -> Math;
    [[nodiscard]] static auto equal(Math left, Math right) -> Math;
    [[nodiscard]] static auto product(Math left, Math right) -> Math;
    [[nodiscard]] static auto center_dot(Math left, Math right) -> Math;
    [[nodiscard]] static auto times(Math left, Math right) -> Math;
    [[nodiscard]] static auto sequence() -> Math;
    [[nodiscard]] static auto
    function(std::string_view name, Delimiter delimiter = Delimiter::parentheses) -> Math;
    [[nodiscard]] static auto
    named_operator(std::string_view name, Delimiter delimiter = Delimiter::square) -> Math;
    [[nodiscard]] static auto delimited(Delimiter delimiter) -> Math;
    [[nodiscard]] static auto inner_product() -> Math;
    [[nodiscard]] static auto summation() -> Math;

    auto append(Math expression) & -> Math&;
    auto append(Math expression) && -> Math&&;
    auto term(Math expression) & -> Math&;
    auto term(Math expression) && -> Math&&;
    auto argument(Math expression) & -> Math&;
    auto argument(Math expression) && -> Math&&;
    auto body(Math expression) & -> Math&;
    auto body(Math expression) && -> Math&&;
    auto lower(Math expression) & -> Math&;
    auto lower(Math expression) && -> Math&&;
    auto upper(Math expression) & -> Math&;
    auto upper(Math expression) && -> Math&&;
    auto subscript(Math expression) & -> Math&;
    auto subscript(Math expression) && -> Math&&;
    auto superscript(Math expression) & -> Math&;
    auto superscript(Math expression) && -> Math&&;
    auto align_at_operator() & -> Math&;
    auto align_at_operator() && -> Math&&;

    [[nodiscard]] auto kind() const -> Kind;
    [[nodiscard]] auto integer_value() const -> i64;
    [[nodiscard]] auto identifier_name() const -> std::string_view;
    [[nodiscard]] auto symbol_value() const -> Symbol;
    [[nodiscard]] auto binary_expression() const -> const BinaryExpression&;
    [[nodiscard]] auto script_base() const -> const Math&;
    [[nodiscard]] auto script_subscript() const -> const Math*;
    [[nodiscard]] auto script_superscript() const -> const Math*;
    [[nodiscard]] auto items() const -> std::span<const Math>;
    [[nodiscard]] auto function_name() const -> std::string_view;
    [[nodiscard]] auto function_is_named_operator() const -> bool;
    [[nodiscard]] auto function_delimiter() const -> Delimiter;
    [[nodiscard]] auto function_argument() const -> const Math*;
    [[nodiscard]] auto delimited_style() const -> Delimiter;
    [[nodiscard]] auto delimited_body() const -> const Math*;
    [[nodiscard]] auto summation_lower() const -> const Math*;
    [[nodiscard]] auto summation_upper() const -> const Math*;
    [[nodiscard]] auto summation_body() const -> const Math*;
    [[nodiscard]] auto explicit_alignment_points() const -> usize;

    auto validate() const -> void;

  private:
    struct Node;

    explicit Math(std::unique_ptr<Node> node) noexcept;
    [[nodiscard]] auto node() -> Node&;
    [[nodiscard]] auto node() const -> const Node&;

    std::unique_ptr<Node> node_{};
};

struct Math::BinaryExpression
{
    Math left;
    BinaryOperator operation{};
    Math right;
    bool align_at_operator{};
};

struct Math::DisplayLine
{
    Math expression;
    std::optional<ReferenceId> reference_id{};
};

class Math::Display final : public DocumentBlock
{
  public:
    static constexpr std::string_view k_type_id = "dans.math.display";

    explicit Display(Math expression, DisplayOptions options = {});
    Display(Math expression, ReferenceId reference_id, DisplayOptions options = {});

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    auto add_equation(Math expression, ReferenceId reference_id) -> Display&;
    auto add_unnumbered(Math expression) -> Display&;
    [[nodiscard]] auto lines() const noexcept -> std::span<const DisplayLine>;
    [[nodiscard]] auto options() const noexcept -> DisplayOptions;

  private:
    auto add_line(DisplayLine line) -> Display&;

    std::vector<DisplayLine> lines_{};
    DisplayOptions options_{};
};

class Math::Inline final : public InlineNode
{
  public:
    static constexpr std::string_view k_type_id = "dans.math.inline";

    explicit Inline(Math expression);

    [[nodiscard]] auto type_id() const noexcept -> std::string_view override;
    [[nodiscard]] auto expression() const noexcept -> const Math&;

  private:
    Math expression_;
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_MATH_HPP
