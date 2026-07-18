#ifndef DANS_TYPESETTING_SRC_WRITERS_LATEX_WRITER_HPP
#define DANS_TYPESETTING_SRC_WRITERS_LATEX_WRITER_HPP

#include "document.hpp"

#include <filesystem>
#include <iosfwd>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace dans::document::writers
{
class LatexWriter;

class LatexOutput
{
  public:
    auto write_raw(std::string_view text) -> void;
    auto write_text(std::string_view text) -> void;
    auto write_blocks(const BlockSequence& blocks) -> void;

  private:
    friend class LatexWriter;

    LatexOutput(std::ostream& output, const LatexWriter& writer, usize section_depth) noexcept;

    std::ostream& output_;
    const LatexWriter& writer_;
    usize section_depth_{};
};

// One connector-side implementation translates one semantic block type into
// LaTeX. Neither the document block nor the generic writer knows the other.
class LatexBlockAdapter
{
  public:
    LatexBlockAdapter() = default;
    virtual ~LatexBlockAdapter() = default;

    LatexBlockAdapter(const LatexBlockAdapter&) = delete;
    auto operator=(const LatexBlockAdapter&) -> LatexBlockAdapter& = delete;
    LatexBlockAdapter(LatexBlockAdapter&&) = delete;
    auto operator=(LatexBlockAdapter&&) -> LatexBlockAdapter& = delete;

    [[nodiscard]] virtual auto block_type_id() const noexcept -> std::string_view = 0;
    virtual auto serialize(const DocumentBlock& block, LatexOutput& output) const -> void = 0;
};

class LatexWriter
{
  public:
    auto register_block_adapter(std::unique_ptr<LatexBlockAdapter> adapter) -> void;
    [[nodiscard]] auto supports_block(std::string_view block_type_id) const noexcept -> bool;

    auto serialize(const Document& document, std::ostream& output) const -> void;
    auto write_file(const Document& document, const std::filesystem::path& output_path) const
        -> void;

  private:
    friend class LatexOutput;

    [[nodiscard]] auto block_adapter_for(std::string_view block_type_id) const noexcept
        -> const LatexBlockAdapter*;
    [[nodiscard]] auto render(const Document& document) const -> std::string;
    auto validate(const Document& document) const -> void;
    auto validate_blocks(const BlockSequence& blocks, usize section_depth) const -> void;
    auto emit_document(const Document& document, LatexOutput& output) const -> void;
    auto emit_blocks(const BlockSequence& blocks, LatexOutput& output) const -> void;

    std::vector<std::unique_ptr<LatexBlockAdapter>> block_adapters_{};
};
}  // namespace dans::document::writers

#endif  // DANS_TYPESETTING_SRC_WRITERS_LATEX_WRITER_HPP
