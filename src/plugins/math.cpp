// src/plugins/math.cpp — implement the structured mathematical presentation model.
#include "plugins/math.hpp"

#include <algorithm>
#include <optional>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <utility>
#include <variant>

namespace
{
auto is_ascii_letter(const char character) noexcept -> bool
{
    return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z');
}

auto is_ascii_digit(const char character) noexcept -> bool
{
    return character >= '0' && character <= '9';
}

auto is_valid_name(const std::string_view name) noexcept -> bool
{
    if (name.empty() || !is_ascii_letter(name.front()))
    {
        return false;
    }

    return std::ranges::all_of(
        name.substr(1),
        [](const char character) { return is_ascii_letter(character) || is_ascii_digit(character); }
    );
}
}  // namespace

namespace dans::document::plugins
{
#define DANS_DEFINE_MATH_INTEGER_SHORTCUT(name)                                                    \
    const Math::Shortcut Math::id_##name                                                           \
    {                                                                                              \
        i64                                                                                        \
        {                                                                                          \
            name                                                                                   \
        }                                                                                          \
    }
#define DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(name)                                                 \
    const Math::Shortcut Math::id_##name                                                           \
    {                                                                                              \
        #name                                                                                      \
    }
#define DANS_DEFINE_MATH_SYMBOL_SHORTCUT(name)                                                     \
    const Math::Shortcut Math::id_##name                                                           \
    {                                                                                              \
        Math::Symbol::name                                                                         \
    }
#define DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(name, symbol_name)                                \
    const Math::Shortcut Math::id_##name                                                           \
    {                                                                                              \
        Math::Symbol::capital_##symbol_name                                                        \
    }

DANS_DEFINE_MATH_INTEGER_SHORTCUT(0);
DANS_DEFINE_MATH_INTEGER_SHORTCUT(1);
DANS_DEFINE_MATH_INTEGER_SHORTCUT(2);
DANS_DEFINE_MATH_INTEGER_SHORTCUT(3);
DANS_DEFINE_MATH_INTEGER_SHORTCUT(4);
DANS_DEFINE_MATH_INTEGER_SHORTCUT(5);
DANS_DEFINE_MATH_INTEGER_SHORTCUT(6);
DANS_DEFINE_MATH_INTEGER_SHORTCUT(7);
DANS_DEFINE_MATH_INTEGER_SHORTCUT(8);
DANS_DEFINE_MATH_INTEGER_SHORTCUT(9);

DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(a);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(b);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(c);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(d);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(e);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(f);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(g);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(h);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(i);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(j);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(k);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(l);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(m);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(n);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(o);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(p);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(q);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(r);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(s);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(t);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(u);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(v);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(w);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(x);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(y);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(z);

DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(A);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(B);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(C);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(D);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(E);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(F);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(G);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(H);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(I);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(J);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(K);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(L);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(M);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(N);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(O);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(P);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(Q);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(R);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(S);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(T);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(U);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(V);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(W);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(X);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(Y);
DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT(Z);

DANS_DEFINE_MATH_SYMBOL_SHORTCUT(alpha);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(beta);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(gamma);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(delta);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(epsilon);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(zeta);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(eta);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(theta);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(iota);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(kappa);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(lambda);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(mu);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(nu);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(xi);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(omicron);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(pi);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(rho);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(sigma);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(tau);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(upsilon);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(phi);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(chi);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(psi);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(omega);

DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Alpha, alpha);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Beta, beta);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Gamma, gamma);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Delta, delta);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Epsilon, epsilon);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Zeta, zeta);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Eta, eta);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Theta, theta);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Iota, iota);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Kappa, kappa);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Lambda, lambda);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Mu, mu);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Nu, nu);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Xi, xi);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Omicron, omicron);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Pi, pi);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Rho, rho);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Sigma, sigma);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Tau, tau);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Upsilon, upsilon);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Phi, phi);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Chi, chi);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Psi, psi);
DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT(Omega, omega);
DANS_DEFINE_MATH_SYMBOL_SHORTCUT(nabla);

#undef DANS_DEFINE_MATH_CAPITAL_SYMBOL_SHORTCUT
#undef DANS_DEFINE_MATH_SYMBOL_SHORTCUT
#undef DANS_DEFINE_MATH_IDENTIFIER_SHORTCUT
#undef DANS_DEFINE_MATH_INTEGER_SHORTCUT

struct Math::Node
{
    struct Integer
    {
        i64 value{};
    };

    struct Identifier
    {
        std::string name{};
    };

    struct Symbol
    {
        Math::Symbol value{};
    };

    struct Script
    {
        Math base;
        std::optional<Math> subscript{};
        std::optional<Math> superscript{};
    };

    struct Sequence
    {
        std::vector<Math> items{};
    };

    struct CommaSeparated
    {
        std::vector<Math> items{};
    };

    struct Function
    {
        std::string name{};
        bool named_operator{};
        Math::Delimiter delimiter{};
        std::optional<Math> argument{};
    };

    struct Delimited
    {
        Math::Delimiter delimiter{};
        std::optional<Math> body{};
    };

    struct InnerProduct
    {
        std::vector<Math> terms{};
    };

    struct Summation
    {
        std::optional<Math> lower{};
        std::optional<Math> upper{};
        std::optional<Math> body{};
    };

    using Value = std::variant<
        Integer,
        Identifier,
        Symbol,
        BinaryExpression,
        Script,
        Sequence,
        CommaSeparated,
        Function,
        Delimited,
        InnerProduct,
        Summation>;

    template <typename ValueType>
    explicit Node(ValueType initial_value) : value{std::move(initial_value)}
    {
    }

    Value value;
};

Math::Math(std::unique_ptr<Node> node) noexcept : node_{std::move(node)}
{
}

Math::~Math() = default;
Math::Math(Math&& other) noexcept = default;
auto Math::operator=(Math&& other) noexcept -> Math& = default;

auto Math::node() -> Node&
{
    if (node_ == nullptr)
    {
        throw std::logic_error{"Cannot use a moved-from math expression"};
    }
    return *node_;
}

auto Math::node() const -> const Node&
{
    if (node_ == nullptr)
    {
        throw std::logic_error{"Cannot use a moved-from math expression"};
    }
    return *node_;
}

auto Math::integer(const i64 value) -> Math
{
    return Math{std::make_unique<Node>(Node::Integer{.value = value})};
}

auto Math::identifier(const std::string_view name) -> Math
{
    if (!is_valid_name(name))
    {
        throw std::invalid_argument{
            "A math identifier must start with an ASCII letter and contain only letters or digits"
        };
    }
    return Math{std::make_unique<Node>(Node::Identifier{.name = std::string{name}})};
}

auto Math::ident(const std::string_view name) -> Math
{
    return identifier(name);
}

auto Math::symbol(const Math::Symbol symbol) -> Math
{
    return Math{std::make_unique<Node>(Node::Symbol{.value = symbol})};
}

auto Math::binary(Math left, const BinaryOperator operation, Math right) -> Math
{
    return Math{std::make_unique<Node>(BinaryExpression{
        .left = std::move(left),
        .operation = operation,
        .right = std::move(right),
        .align_at_operator = false,
    })};
}

auto Math::add(Math left, Math right) -> Math
{
    return binary(std::move(left), BinaryOperator::add, std::move(right));
}

auto Math::subtract(Math left, Math right) -> Math
{
    return binary(std::move(left), BinaryOperator::subtract, std::move(right));
}

auto Math::equal(Math left, Math right) -> Math
{
    return binary(std::move(left), BinaryOperator::equal, std::move(right));
}

auto Math::product(Math left, Math right) -> Math
{
    return binary(std::move(left), BinaryOperator::product, std::move(right));
}

auto Math::center_dot(Math left, Math right) -> Math
{
    return binary(std::move(left), BinaryOperator::center_dot, std::move(right));
}

auto Math::times(Math left, Math right) -> Math
{
    return binary(std::move(left), BinaryOperator::times, std::move(right));
}

auto Math::sequence() -> Math
{
    return Math{std::make_unique<Node>(Node::Sequence{})};
}

auto Math::csv() -> Math
{
    return Math{std::make_unique<Node>(Node::CommaSeparated{})};
}

auto Math::function(const std::string_view name, const Math::Delimiter delimiter) -> Math
{
    if (!is_valid_name(name))
    {
        throw std::invalid_argument{"A math function name must be an ASCII identifier"};
    }
    return Math{std::make_unique<Node>(Node::Function{
        .name = std::string{name},
        .named_operator = false,
        .delimiter = delimiter,
        .argument = std::nullopt,
    })};
}

auto Math::named_operator(const std::string_view name, const Math::Delimiter delimiter) -> Math
{
    if (!is_valid_name(name))
    {
        throw std::invalid_argument{"A named math operator must be an ASCII identifier"};
    }
    return Math{std::make_unique<Node>(Node::Function{
        .name = std::string{name},
        .named_operator = true,
        .delimiter = delimiter,
        .argument = std::nullopt,
    })};
}

auto Math::delimited(const Math::Delimiter delimiter) -> Math
{
    return Math{
        std::make_unique<Node>(Node::Delimited{.delimiter = delimiter, .body = std::nullopt})
    };
}

auto Math::inner_product() -> Math
{
    return Math{std::make_unique<Node>(Node::InnerProduct{})};
}

auto Math::summation() -> Math
{
    return Math{std::make_unique<Node>(Node::Summation{})};
}

auto Math::append(Math expression) & -> Math&
{
    if (auto* sequence_node = std::get_if<Node::Sequence>(&node().value); sequence_node != nullptr)
    {
        sequence_node->items.push_back(std::move(expression));
        return *this;
    }
    if (auto* comma_separated_node = std::get_if<Node::CommaSeparated>(&node().value);
        comma_separated_node != nullptr)
    {
        comma_separated_node->items.push_back(std::move(expression));
        return *this;
    }
    throw std::logic_error{"append() is valid only for a sequence or comma-separated list"};
}

auto Math::append(Math expression) && -> Math&&
{
    append(std::move(expression));
    return std::move(*this);
}

auto Math::term(Math expression) & -> Math&
{
    auto* inner_product_node = std::get_if<Node::InnerProduct>(&node().value);
    if (inner_product_node == nullptr)
    {
        throw std::logic_error{"term() is valid only for an inner-product expression"};
    }
    inner_product_node->terms.push_back(std::move(expression));
    return *this;
}

auto Math::term(Math expression) && -> Math&&
{
    term(std::move(expression));
    return std::move(*this);
}

auto Math::argument(Math expression) & -> Math&
{
    auto* function_node = std::get_if<Node::Function>(&node().value);
    if (function_node == nullptr)
    {
        throw std::logic_error{"argument() is valid only for a function expression"};
    }
    function_node->argument = std::move(expression);
    return *this;
}

auto Math::argument(Math expression) && -> Math&&
{
    argument(std::move(expression));
    return std::move(*this);
}

auto Math::body(Math expression) & -> Math&
{
    if (auto* delimited_node = std::get_if<Node::Delimited>(&node().value);
        delimited_node != nullptr)
    {
        delimited_node->body = std::move(expression);
        return *this;
    }
    if (auto* summation_node = std::get_if<Node::Summation>(&node().value);
        summation_node != nullptr)
    {
        summation_node->body = std::move(expression);
        return *this;
    }
    throw std::logic_error{"body() is valid only for delimited or summation expressions"};
}

auto Math::body(Math expression) && -> Math&&
{
    body(std::move(expression));
    return std::move(*this);
}

auto Math::lower(Math expression) & -> Math&
{
    auto* summation_node = std::get_if<Node::Summation>(&node().value);
    if (summation_node == nullptr)
    {
        throw std::logic_error{"lower() is valid only for a summation expression"};
    }
    summation_node->lower = std::move(expression);
    return *this;
}

auto Math::lower(Math expression) && -> Math&&
{
    lower(std::move(expression));
    return std::move(*this);
}

auto Math::upper(Math expression) & -> Math&
{
    auto* summation_node = std::get_if<Node::Summation>(&node().value);
    if (summation_node == nullptr)
    {
        throw std::logic_error{"upper() is valid only for a summation expression"};
    }
    summation_node->upper = std::move(expression);
    return *this;
}

auto Math::upper(Math expression) && -> Math&&
{
    upper(std::move(expression));
    return std::move(*this);
}

auto Math::subscript(Math expression) & -> Math&
{
    if (auto* script_node = std::get_if<Node::Script>(&node().value); script_node != nullptr)
    {
        script_node->subscript = std::move(expression);
        return *this;
    }

    auto base = Math{std::move(node_)};
    node_ = std::make_unique<Node>(Node::Script{
        .base = std::move(base),
        .subscript = std::move(expression),
        .superscript = std::nullopt,
    });
    return *this;
}

auto Math::subscript(Math expression) && -> Math&&
{
    subscript(std::move(expression));
    return std::move(*this);
}

auto Math::superscript(Math expression) & -> Math&
{
    if (auto* script_node = std::get_if<Node::Script>(&node().value); script_node != nullptr)
    {
        script_node->superscript = std::move(expression);
        return *this;
    }

    auto base = Math{std::move(node_)};
    node_ = std::make_unique<Node>(Node::Script{
        .base = std::move(base),
        .subscript = std::nullopt,
        .superscript = std::move(expression),
    });
    return *this;
}

auto Math::superscript(Math expression) && -> Math&&
{
    superscript(std::move(expression));
    return std::move(*this);
}

auto Math::align_at_operator() & -> Math&
{
    auto* binary_node = std::get_if<BinaryExpression>(&node().value);
    if (binary_node == nullptr)
    {
        throw std::logic_error{"align_at_operator() is valid only for a binary expression"};
    }
    binary_node->align_at_operator = true;
    return *this;
}

auto Math::align_at_operator() && -> Math&&
{
    align_at_operator();
    return std::move(*this);
}

Math::Shortcut::operator Math() const
{
    switch (kind_)
    {
        case Kind::integer:
            return Math::integer(integer_);
        case Kind::identifier:
            return Math::identifier(identifier_);
        case Kind::symbol:
            return Math::symbol(symbol_);
    }
    throw std::logic_error{"Unknown math shortcut kind"};
}

auto Math::Shortcut::subscript(Math expression) const -> Math
{
    auto value = static_cast<Math>(*this);
    value.subscript(std::move(expression));
    return value;
}

auto Math::Shortcut::superscript(Math expression) const -> Math
{
    auto value = static_cast<Math>(*this);
    value.superscript(std::move(expression));
    return value;
}

auto Math::kind() const -> Kind
{
    return std::visit(
        [](const auto& value) -> Kind
        {
            using Value = std::remove_cvref_t<decltype(value)>;
            if constexpr (std::is_same_v<Value, Node::Integer>)
            {
                return Kind::integer;
            }
            else if constexpr (std::is_same_v<Value, Node::Identifier>)
            {
                return Kind::identifier;
            }
            else if constexpr (std::is_same_v<Value, Node::Symbol>)
            {
                return Kind::symbol;
            }
            else if constexpr (std::is_same_v<Value, BinaryExpression>)
            {
                return Kind::binary;
            }
            else if constexpr (std::is_same_v<Value, Node::Script>)
            {
                return Kind::script;
            }
            else if constexpr (std::is_same_v<Value, Node::Sequence>)
            {
                return Kind::sequence;
            }
            else if constexpr (std::is_same_v<Value, Node::CommaSeparated>)
            {
                return Kind::comma_separated;
            }
            else if constexpr (std::is_same_v<Value, Node::Function>)
            {
                return Kind::function;
            }
            else if constexpr (std::is_same_v<Value, Node::Delimited>)
            {
                return Kind::delimited;
            }
            else if constexpr (std::is_same_v<Value, Node::InnerProduct>)
            {
                return Kind::inner_product;
            }
            else
            {
                static_assert(std::is_same_v<Value, Node::Summation>);
                return Kind::summation;
            }
        },
        node().value
    );
}

auto Math::integer_value() const -> i64
{
    return std::get<Node::Integer>(node().value).value;
}

auto Math::identifier_name() const -> std::string_view
{
    return std::get<Node::Identifier>(node().value).name;
}

auto Math::symbol_value() const -> Math::Symbol
{
    return std::get<Node::Symbol>(node().value).value;
}

auto Math::binary_expression() const -> const BinaryExpression&
{
    return std::get<BinaryExpression>(node().value);
}

auto Math::script_base() const -> const Math&
{
    return std::get<Node::Script>(node().value).base;
}

auto Math::script_subscript() const -> const Math*
{
    const auto& value = std::get<Node::Script>(node().value).subscript;
    return value.has_value() ? &*value : nullptr;
}

auto Math::script_superscript() const -> const Math*
{
    const auto& value = std::get<Node::Script>(node().value).superscript;
    return value.has_value() ? &*value : nullptr;
}

auto Math::items() const -> std::span<const Math>
{
    if (const auto* sequence_node = std::get_if<Node::Sequence>(&node().value);
        sequence_node != nullptr)
    {
        return sequence_node->items;
    }
    if (const auto* inner_product_node = std::get_if<Node::InnerProduct>(&node().value);
        inner_product_node != nullptr)
    {
        return inner_product_node->terms;
    }
    if (const auto* comma_separated_node = std::get_if<Node::CommaSeparated>(&node().value);
        comma_separated_node != nullptr)
    {
        return comma_separated_node->items;
    }
    throw std::logic_error{
        "items() is valid only for sequence, comma-separated, or inner-product expressions"
    };
}

auto Math::function_name() const -> std::string_view
{
    return std::get<Node::Function>(node().value).name;
}

auto Math::function_is_named_operator() const -> bool
{
    return std::get<Node::Function>(node().value).named_operator;
}

auto Math::function_delimiter() const -> Math::Delimiter
{
    return std::get<Node::Function>(node().value).delimiter;
}

auto Math::function_argument() const -> const Math*
{
    const auto& value = std::get<Node::Function>(node().value).argument;
    return value.has_value() ? &*value : nullptr;
}

auto Math::delimited_style() const -> Math::Delimiter
{
    return std::get<Node::Delimited>(node().value).delimiter;
}

auto Math::delimited_body() const -> const Math*
{
    const auto& value = std::get<Node::Delimited>(node().value).body;
    return value.has_value() ? &*value : nullptr;
}

auto Math::summation_lower() const -> const Math*
{
    const auto& value = std::get<Node::Summation>(node().value).lower;
    return value.has_value() ? &*value : nullptr;
}

auto Math::summation_upper() const -> const Math*
{
    const auto& value = std::get<Node::Summation>(node().value).upper;
    return value.has_value() ? &*value : nullptr;
}

auto Math::summation_body() const -> const Math*
{
    const auto& value = std::get<Node::Summation>(node().value).body;
    return value.has_value() ? &*value : nullptr;
}

auto Math::explicit_alignment_points() const -> usize
{
    switch (kind())
    {
        case Kind::integer:
        case Kind::identifier:
        case Kind::symbol:
            return 0;
        case Kind::binary:
            return (binary_expression().align_at_operator ? usize{1} : usize{0})
                   + binary_expression().left.explicit_alignment_points()
                   + binary_expression().right.explicit_alignment_points();
        case Kind::script:
            {
                auto count = script_base().explicit_alignment_points();
                if (const auto* expression = script_subscript(); expression != nullptr)
                {
                    count += expression->explicit_alignment_points();
                }
                if (const auto* expression = script_superscript(); expression != nullptr)
                {
                    count += expression->explicit_alignment_points();
                }
                return count;
            }
        case Kind::sequence:
        case Kind::comma_separated:
        case Kind::inner_product:
            {
                usize count{};
                for (const auto& expression : items())
                {
                    count += expression.explicit_alignment_points();
                }
                return count;
            }
        case Kind::function:
            return function_argument() == nullptr
                       ? usize{0}
                       : function_argument()->explicit_alignment_points();
        case Kind::delimited:
            return delimited_body() == nullptr ? usize{0}
                                               : delimited_body()->explicit_alignment_points();
        case Kind::summation:
            {
                usize count{};
                if (const auto* expression = summation_lower(); expression != nullptr)
                {
                    count += expression->explicit_alignment_points();
                }
                if (const auto* expression = summation_upper(); expression != nullptr)
                {
                    count += expression->explicit_alignment_points();
                }
                if (const auto* expression = summation_body(); expression != nullptr)
                {
                    count += expression->explicit_alignment_points();
                }
                return count;
            }
    }
    throw std::logic_error{"Unknown structured-math expression kind"};
}

auto Math::validate() const -> void
{
    switch (kind())
    {
        case Kind::integer:
        case Kind::identifier:
        case Kind::symbol:
            return;
        case Kind::binary:
            binary_expression().left.validate();
            binary_expression().right.validate();
            return;
        case Kind::script:
            script_base().validate();
            if (const auto* expression = script_subscript(); expression != nullptr)
            {
                expression->validate();
            }
            if (const auto* expression = script_superscript(); expression != nullptr)
            {
                expression->validate();
            }
            if (script_subscript() == nullptr && script_superscript() == nullptr)
            {
                throw std::logic_error{"A math script requires a subscript or superscript"};
            }
            return;
        case Kind::sequence:
            if (items().size() < usize{2})
            {
                throw std::logic_error{"A math sequence requires at least two items"};
            }
            for (const auto& expression : items())
            {
                expression.validate();
            }
            return;
        case Kind::comma_separated:
            if (items().size() < usize{2})
            {
                throw std::logic_error{"A comma-separated expression requires at least two items"};
            }
            for (const auto& expression : items())
            {
                expression.validate();
            }
            return;
        case Kind::function:
            if (function_argument() == nullptr)
            {
                throw std::logic_error{"A math function requires an argument"};
            }
            function_argument()->validate();
            return;
        case Kind::delimited:
            if (delimited_body() == nullptr)
            {
                throw std::logic_error{"A delimited math expression requires a body"};
            }
            delimited_body()->validate();
            return;
        case Kind::inner_product:
            if (items().size() < usize{2})
            {
                throw std::logic_error{"An inner product requires at least two terms"};
            }
            for (const auto& expression : items())
            {
                expression.validate();
            }
            return;
        case Kind::summation:
            if (summation_body() == nullptr)
            {
                throw std::logic_error{"A summation requires a body"};
            }
            if (const auto* expression = summation_lower(); expression != nullptr)
            {
                expression->validate();
            }
            if (const auto* expression = summation_upper(); expression != nullptr)
            {
                expression->validate();
            }
            summation_body()->validate();
            return;
    }
    throw std::logic_error{"Unknown structured-math expression kind"};
}

Math::Display::Display(Math expression, const DisplayOptions options) : options_{options}
{
    add_unnumbered(std::move(expression));
}

Math::Display::Display(Math expression, ReferenceId reference_id, const DisplayOptions options)
    : options_{options}
{
    add_equation(std::move(expression), std::move(reference_id));
}

auto Math::Display::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Math::Display::add_equation(Math expression, ReferenceId reference_id) -> Display&
{
    return add_line(
        DisplayLine{
            .expression = std::move(expression),
            .reference_id = std::move(reference_id),
        }
    );
}

auto Math::Display::add_unnumbered(Math expression) -> Display&
{
    return add_line(
        DisplayLine{
            .expression = std::move(expression),
            .reference_id = std::nullopt,
        }
    );
}

auto Math::Display::add_line(DisplayLine line) -> Display&
{
    line.expression.validate();
    const auto alignment_points = line.expression.explicit_alignment_points();
    if (alignment_points > usize{1})
    {
        throw std::invalid_argument{"A displayed equation may contain at most one alignment point"};
    }
    if (options_.alignment == DisplayAlignment::disabled && alignment_points != usize{0})
    {
        throw std::invalid_argument{
            "A displayed equation cannot set an alignment point when alignment is disabled"
        };
    }
    if (!lines_.empty()
        && (lines_.front().expression.explicit_alignment_points() == usize{0})
               != (alignment_points == usize{0}))
    {
        throw std::invalid_argument{
            "Every equation in an aligned display must set one explicit alignment point or set none"
        };
    }
    lines_.push_back(std::move(line));
    return *this;
}

auto Math::Display::lines() const noexcept -> std::span<const DisplayLine>
{
    return lines_;
}

auto Math::Display::options() const noexcept -> DisplayOptions
{
    return options_;
}

Math::Inline::Inline(Math expression) : expression_{std::move(expression)}
{
    expression_.validate();
    if (expression_.explicit_alignment_points() != usize{0})
    {
        throw std::invalid_argument{"Inline math cannot contain a display alignment point"};
    }
}

auto Math::Inline::type_id() const noexcept -> std::string_view
{
    return k_type_id;
}

auto Math::Inline::expression() const noexcept -> const Math&
{
    return expression_;
}
}  // namespace dans::document::plugins
