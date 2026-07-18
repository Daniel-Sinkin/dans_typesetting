#ifndef DANS_TYPESETTING_SRC_COMMON_HPP
#define DANS_TYPESETTING_SRC_COMMON_HPP

#include <cstddef>
#include <cstdint>
#include <type_traits>

namespace dans
{
using usize = std::size_t;
using isize = std::ptrdiff_t;

using uptr = std::uintptr_t;
using iptr = std::intptr_t;

using c8 = char8_t;

using u8 = std::uint8_t;
using u16 = std::uint16_t;
using u32 = std::uint32_t;
using u64 = std::uint64_t;

using i8 = std::int8_t;
using i16 = std::int16_t;
using i32 = std::int32_t;
using i64 = std::int64_t;

using f32 = float;
using f64 = double;

static_assert(std::is_same_v<usize, decltype(sizeof(void*))>);
static_assert(
    std::is_same_v<isize, decltype(static_cast<int*>(nullptr) - static_cast<int*>(nullptr))>
);

static_assert(sizeof(std::byte) == usize{1});
static_assert(sizeof(c8) == usize{1});
static_assert(sizeof(u8) == usize{1});
static_assert(sizeof(u16) == usize{2});
static_assert(sizeof(u32) == usize{4});
static_assert(sizeof(u64) == usize{8});
static_assert(sizeof(i8) == usize{1});
static_assert(sizeof(i16) == usize{2});
static_assert(sizeof(i32) == usize{4});
static_assert(sizeof(i64) == usize{8});
static_assert(sizeof(f32) == usize{4});
static_assert(sizeof(f64) == usize{8});
}  // namespace dans

#endif  // DANS_TYPESETTING_SRC_COMMON_HPP
