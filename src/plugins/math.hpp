// src/plugins/math.hpp — define the structured-math value and its document hosts.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_MATH_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_MATH_HPP

#include "plugins/core_paragraph.hpp"
#include "reference_id.hpp"

#include <concepts>
#include <memory>
#include <optional>
#include <span>
#include <string_view>
#include <utility>
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
        gamma,
        delta,
        epsilon,
        zeta,
        eta,
        theta,
        iota,
        kappa,
        lambda,
        mu,
        nu,
        xi,
        omicron,
        pi,
        rho,
        sigma,
        tau,
        upsilon,
        phi,
        chi,
        psi,
        omega,
        capital_alpha,
        capital_beta,
        capital_gamma,
        capital_delta,
        capital_epsilon,
        capital_zeta,
        capital_eta,
        capital_theta,
        capital_iota,
        capital_kappa,
        capital_lambda,
        capital_mu,
        capital_nu,
        capital_xi,
        capital_omicron,
        capital_pi,
        capital_rho,
        capital_sigma,
        capital_tau,
        capital_upsilon,
        capital_phi,
        capital_chi,
        capital_psi,
        capital_omega,
        nabla,
        asterisk,
    };

    class Shortcut final
    {
      public:
        constexpr explicit Shortcut(i64 value) noexcept : kind_{Kind::integer}, integer_{value}
        {
        }

        constexpr explicit Shortcut(std::string_view name) noexcept
            : kind_{Kind::identifier}, identifier_{name}
        {
        }

        constexpr explicit Shortcut(Symbol symbol) noexcept : kind_{Kind::symbol}, symbol_{symbol}
        {
        }

        [[nodiscard]] operator Math() const;
        [[nodiscard]] auto subscript(Math expression) const -> Math;
        [[nodiscard]] auto superscript(Math expression) const -> Math;

      private:
        enum class Kind : u8
        {
            integer,
            identifier,
            symbol,
        };

        Kind kind_{};
        i64 integer_{};
        std::string_view identifier_{};
        Symbol symbol_{};
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
        comma_separated,
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
    [[nodiscard]] static auto ident(std::string_view name) -> Math;
    [[nodiscard]] static auto symbol(Symbol symbol) -> Math;
    [[nodiscard]] static auto binary(Math left, BinaryOperator operation, Math right) -> Math;
    [[nodiscard]] static auto add(Math left, Math right) -> Math;
    [[nodiscard]] static auto subtract(Math left, Math right) -> Math;
    [[nodiscard]] static auto equal(Math left, Math right) -> Math;
    [[nodiscard]] static auto product(Math left, Math right) -> Math;
    [[nodiscard]] static auto center_dot(Math left, Math right) -> Math;
    [[nodiscard]] static auto times(Math left, Math right) -> Math;
    [[nodiscard]] static auto sequence() -> Math;
    template <typename... Expressions>
        requires(sizeof...(Expressions) > 0 && (std::convertible_to<Expressions &&, Math> && ...))
    [[nodiscard]] static auto sequence(Expressions&&... expressions) -> Math
    {
        auto result = sequence();
        (result.append(static_cast<Math>(std::forward<Expressions>(expressions))), ...);
        return result;
    }
    [[nodiscard]] static auto csv() -> Math;
    template <typename... Expressions>
        requires(sizeof...(Expressions) > 0 && (std::convertible_to<Expressions &&, Math> && ...))
    [[nodiscard]] static auto csv(Expressions&&... expressions) -> Math
    {
        auto result = csv();
        (result.append(static_cast<Math>(std::forward<Expressions>(expressions))), ...);
        return result;
    }
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

    // Common leaves are lightweight factories. Each conversion creates a new
    // owning expression, so scripts can be chained without sharing AST state.
    static const Shortcut id_0;
    static const Shortcut id_1;
    static const Shortcut id_2;
    static const Shortcut id_3;
    static const Shortcut id_4;
    static const Shortcut id_5;
    static const Shortcut id_6;
    static const Shortcut id_7;
    static const Shortcut id_8;
    static const Shortcut id_9;

    static const Shortcut id_a;
    static const Shortcut id_b;
    static const Shortcut id_c;
    static const Shortcut id_d;
    static const Shortcut id_e;
    static const Shortcut id_f;
    static const Shortcut id_g;
    static const Shortcut id_h;
    static const Shortcut id_i;
    static const Shortcut id_j;
    static const Shortcut id_k;
    static const Shortcut id_l;
    static const Shortcut id_m;
    static const Shortcut id_n;
    static const Shortcut id_o;
    static const Shortcut id_p;
    static const Shortcut id_q;
    static const Shortcut id_r;
    static const Shortcut id_s;
    static const Shortcut id_t;
    static const Shortcut id_u;
    static const Shortcut id_v;
    static const Shortcut id_w;
    static const Shortcut id_x;
    static const Shortcut id_y;
    static const Shortcut id_z;

    static const Shortcut id_A;
    static const Shortcut id_B;
    static const Shortcut id_C;
    static const Shortcut id_D;
    static const Shortcut id_E;
    static const Shortcut id_F;
    static const Shortcut id_G;
    static const Shortcut id_H;
    static const Shortcut id_I;
    static const Shortcut id_J;
    static const Shortcut id_K;
    static const Shortcut id_L;
    static const Shortcut id_M;
    static const Shortcut id_N;
    static const Shortcut id_O;
    static const Shortcut id_P;
    static const Shortcut id_Q;
    static const Shortcut id_R;
    static const Shortcut id_S;
    static const Shortcut id_T;
    static const Shortcut id_U;
    static const Shortcut id_V;
    static const Shortcut id_W;
    static const Shortcut id_X;
    static const Shortcut id_Y;
    static const Shortcut id_Z;

    static const Shortcut id_alpha;
    static const Shortcut id_beta;
    static const Shortcut id_gamma;
    static const Shortcut id_delta;
    static const Shortcut id_epsilon;
    static const Shortcut id_zeta;
    static const Shortcut id_eta;
    static const Shortcut id_theta;
    static const Shortcut id_iota;
    static const Shortcut id_kappa;
    static const Shortcut id_lambda;
    static const Shortcut id_mu;
    static const Shortcut id_nu;
    static const Shortcut id_xi;
    static const Shortcut id_omicron;
    static const Shortcut id_pi;
    static const Shortcut id_rho;
    static const Shortcut id_sigma;
    static const Shortcut id_tau;
    static const Shortcut id_upsilon;
    static const Shortcut id_phi;
    static const Shortcut id_chi;
    static const Shortcut id_psi;
    static const Shortcut id_omega;

    static const Shortcut id_Alpha;
    static const Shortcut id_Beta;
    static const Shortcut id_Gamma;
    static const Shortcut id_Delta;
    static const Shortcut id_Epsilon;
    static const Shortcut id_Zeta;
    static const Shortcut id_Eta;
    static const Shortcut id_Theta;
    static const Shortcut id_Iota;
    static const Shortcut id_Kappa;
    static const Shortcut id_Lambda;
    static const Shortcut id_Mu;
    static const Shortcut id_Nu;
    static const Shortcut id_Xi;
    static const Shortcut id_Omicron;
    static const Shortcut id_Pi;
    static const Shortcut id_Rho;
    static const Shortcut id_Sigma;
    static const Shortcut id_Tau;
    static const Shortcut id_Upsilon;
    static const Shortcut id_Phi;
    static const Shortcut id_Chi;
    static const Shortcut id_Psi;
    static const Shortcut id_Omega;
    static const Shortcut id_nabla;

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
