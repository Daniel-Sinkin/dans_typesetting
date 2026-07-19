// Compose the core structured-math grid primitive into matrices and vectors.
#ifndef DANS_TYPESETTING_SRC_PLUGINS_MATH_MATVEC_HPP
#define DANS_TYPESETTING_SRC_PLUGINS_MATH_MATVEC_HPP

#include "plugins/math.hpp"

#include <concepts>
#include <type_traits>
#include <utility>
#include <vector>

namespace dans::document::plugins
{
// MatVec is an optional authoring extension. It contributes no new expression
// kind: matrices and vectors lower to a delimited core grid, so every math
// writer that implements grids can consume them without knowing this helper.
class Math::MatVec final
{
  public:
    class Row final
    {
      public:
        Row(Row&& other) noexcept = default;
        auto operator=(Row&& other) noexcept -> Row& = default;

        Row(const Row&) = delete;
        auto operator=(const Row&) -> Row& = delete;

      private:
        friend class MatVec;

        explicit Row(std::vector<Math> cells) : cells_{std::move(cells)}
        {
        }

        std::vector<Math> cells_{};
    };

    template <typename... Expressions>
        requires(sizeof...(Expressions) > 0 && (std::convertible_to<Expressions &&, Math> && ...))
    [[nodiscard]] static auto row(Expressions&&... expressions) -> Row
    {
        return Row{collect(std::forward<Expressions>(expressions)...)};
    }

    template <typename... Rows>
        requires(sizeof...(Rows) > 0 && (std::same_as<std::remove_cvref_t<Rows>, Row> && ...))
    [[nodiscard]] static auto matrix(Rows&&... rows) -> Math
    {
        std::vector<Row> owned_rows{};
        owned_rows.reserve(sizeof...(Rows));
        (owned_rows.push_back(std::forward<Rows>(rows)), ...);
        return matrix_from_rows(std::move(owned_rows));
    }

    template <typename... Expressions>
        requires(sizeof...(Expressions) > 0 && (std::convertible_to<Expressions &&, Math> && ...))
    [[nodiscard]] static auto row_vector(Expressions&&... expressions) -> Math
    {
        auto cells = collect(std::forward<Expressions>(expressions)...);
        const auto columns = cells.size();
        return bracket(Math::grid(usize{1}, columns, std::move(cells)));
    }

    template <typename... Expressions>
        requires(sizeof...(Expressions) > 0 && (std::convertible_to<Expressions &&, Math> && ...))
    [[nodiscard]] static auto column_vector(Expressions&&... expressions) -> Math
    {
        auto cells = collect(std::forward<Expressions>(expressions)...);
        const auto rows = cells.size();
        return bracket(Math::grid(rows, usize{1}, std::move(cells)));
    }

  private:
    template <typename... Expressions>
    [[nodiscard]] static auto collect(Expressions&&... expressions) -> std::vector<Math>
    {
        std::vector<Math> cells{};
        cells.reserve(sizeof...(Expressions));
        (cells.push_back(static_cast<Math>(std::forward<Expressions>(expressions))), ...);
        return cells;
    }

    [[nodiscard]] static auto matrix_from_rows(std::vector<Row> rows) -> Math;
    [[nodiscard]] static auto bracket(Math grid) -> Math;
};
}  // namespace dans::document::plugins

#endif  // DANS_TYPESETTING_SRC_PLUGINS_MATH_MATVEC_HPP
