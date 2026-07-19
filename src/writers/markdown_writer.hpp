// src/writers/markdown_writer.hpp — define the connector-driven Markdown writer contract.
#ifndef DANS_TYPESETTING_SRC_WRITERS_MARKDOWN_WRITER_HPP
#define DANS_TYPESETTING_SRC_WRITERS_MARKDOWN_WRITER_HPP

#include "document.hpp"

#include <filesystem>
#include <iosfwd>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace dans::document::writers
{
class MarkdownWriter;
class MarkdownRenderContext;

[[nodiscard]] auto escape_markdown_text(std::string_view text) -> std::string;
[[nodiscard]] auto markdown_link_destination(std::string_view destination) -> std::string;

class MarkdownOutput
{
  public:
    auto write_raw(std::string_view text) -> void;
    auto write_text(std::string_view text) -> void;
    auto write_blocks(const BlockSequence& blocks) -> void;
    auto write_table_of_contents() -> void;
    auto write_anchor(const ReferenceId& reference_id) -> void;
    [[nodiscard]] auto register_footnote(std::string content) -> std::string;

    [[nodiscard]] auto target_number(const DocumentBlock& block) const -> std::string_view;
    [[nodiscard]] auto target_number(const ReferenceId& reference_id) const -> std::string_view;
    [[nodiscard]] auto reference_link(const ReferenceId& reference_id) const -> std::string;
    [[nodiscard]] auto resource_number(std::string_view namespace_id, std::string_view key) const
        -> std::string_view;
    [[nodiscard]] auto resource_anchor(std::string_view namespace_id, std::string_view key) const
        -> std::string_view;

  private:
    friend class MarkdownWriter;

    MarkdownOutput(
        std::ostream& output,
        const MarkdownWriter& writer,
        MarkdownRenderContext& context,
        usize section_depth
    ) noexcept;

    std::ostream& output_;
    const MarkdownWriter& writer_;
    MarkdownRenderContext& context_;
    usize section_depth_{};
};

struct MarkdownTargetDescriptor
{
    const ReferenceId* reference_id{};
    std::string_view label{};
    std::string_view numbering_series{};
};

struct MarkdownResourceDescriptor
{
    std::string_view namespace_id{};
    std::string_view key{};
};

// A connector may publish target descriptors in addition to serializing its
// block. The writer can then derive stable visible ordinals and resolve cross
// references without learning the concrete plugin type.
class MarkdownBlockAdapter
{
  public:
    MarkdownBlockAdapter() = default;
    virtual ~MarkdownBlockAdapter() = default;

    MarkdownBlockAdapter(const MarkdownBlockAdapter&) = delete;
    auto operator=(const MarkdownBlockAdapter&) -> MarkdownBlockAdapter& = delete;
    MarkdownBlockAdapter(MarkdownBlockAdapter&&) = delete;
    auto operator=(MarkdownBlockAdapter&&) -> MarkdownBlockAdapter& = delete;

    [[nodiscard]] virtual auto block_type_id() const noexcept -> std::string_view = 0;
    [[nodiscard]] virtual auto targets(const DocumentBlock& block) const
        -> std::vector<MarkdownTargetDescriptor>;
    [[nodiscard]] virtual auto resources(const DocumentBlock& block) const
        -> std::vector<MarkdownResourceDescriptor>;
    virtual auto serialize(const DocumentBlock& block, MarkdownOutput& output) const -> void = 0;
};

class MarkdownWriter
{
  public:
    auto register_block_adapter(std::unique_ptr<MarkdownBlockAdapter> adapter) -> void;
    [[nodiscard]] auto supports_block(std::string_view block_type_id) const noexcept -> bool;

    auto serialize(const Document& document, std::ostream& output) const -> void;
    auto write_file(const Document& document, const std::filesystem::path& output_path) const
        -> void;

  private:
    friend class MarkdownOutput;

    [[nodiscard]] auto block_adapter_for(std::string_view block_type_id) const noexcept
        -> const MarkdownBlockAdapter*;
    [[nodiscard]] auto render(const Document& document) const -> std::string;
    [[nodiscard]] auto prepare_context(const Document& document) const -> MarkdownRenderContext;
    auto emit_document(const Document& document, MarkdownOutput& output) const -> void;
    auto emit_blocks(const BlockSequence& blocks, MarkdownOutput& output) const -> void;
    auto emit_table_of_contents(MarkdownOutput& output) const -> void;
    auto emit_footnotes(MarkdownOutput& output) const -> void;

    std::vector<std::unique_ptr<MarkdownBlockAdapter>> block_adapters_{};
};
}  // namespace dans::document::writers

#endif  // DANS_TYPESETTING_SRC_WRITERS_MARKDOWN_WRITER_HPP
