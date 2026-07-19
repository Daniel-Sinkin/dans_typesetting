// app/publish.cpp — publish a supported .dans_doc through LaTeX and native PDF paths.
#include "connectors/latex/inline_sequence.hpp"
#include "connectors/latex/paragraph.hpp"
#include "connectors/latex_like/paragraph.hpp"
#include "connectors/transport/paragraph.hpp"
#include "fonts/type1_font.hpp"
#include "transport/document_materializer.hpp"
#include "transport/document_transport.hpp"
#include "writers/latex_like_pdf_writer.hpp"
#include "writers/latex_writer.hpp"

#include <cstdlib>
#include <exception>
#include <filesystem>
#include <memory>
#include <print>
#include <span>
#include <string_view>

#ifndef DANS_TYPESETTING_DEFAULT_LMR10_PFB
#    error "DANS_TYPESETTING_DEFAULT_LMR10_PFB must identify the Latin Modern Type 1 font"
#endif

#ifndef DANS_TYPESETTING_DEFAULT_LMR10_AFM
#    error "DANS_TYPESETTING_DEFAULT_LMR10_AFM must identify the Latin Modern AFM metrics"
#endif

namespace
{
[[nodiscard]] auto make_materializer() -> dans::document::transport::DocumentMaterializer
{
    dans::document::transport::DocumentMaterializer materializer;
    materializer.register_block_materializer(
        std::make_unique<dans::document::connectors::transport::ParagraphMaterializer>()
    );
    materializer.register_inline_materializer(
        std::make_unique<dans::document::connectors::transport::TextMaterializer>()
    );
    return materializer;
}

[[nodiscard]] auto make_latex_writer() -> dans::document::writers::LatexWriter
{
    auto inline_renderer =
        std::make_shared<dans::document::connectors::latex::InlineLatexRenderer>();
    inline_renderer->register_inline_adapter(
        std::make_unique<dans::document::connectors::latex::TextLatexAdapter>()
    );
    dans::document::writers::LatexWriter writer;
    writer.register_block_adapter(
        std::make_unique<dans::document::connectors::latex::ParagraphLatexAdapter>(inline_renderer)
    );
    return writer;
}

[[nodiscard]] auto
make_native_writer(const std::shared_ptr<const dans::document::fonts::Type1Font>& font)
    -> dans::document::writers::LatexLikePdfWriter
{
    auto inline_renderer =
        std::make_shared<dans::document::connectors::latex_like::InlineTextRenderer>();
    inline_renderer->register_inline_adapter(
        std::make_unique<dans::document::connectors::latex_like::TextAdapter>()
    );
    dans::document::writers::LatexLikePdfWriter writer{font};
    writer.register_block_adapter(
        std::make_unique<dans::document::connectors::latex_like::ParagraphAdapter>(inline_renderer)
    );
    return writer;
}

auto run(const std::span<char*> arguments) -> int
{
    if (arguments.size() != 4U && arguments.size() != 6U)
    {
        std::println(
            stderr,
            "Usage: document_publish <input.dans_doc> <output.tex> <output.pdf> "
            "[roman-font.pfb roman-font.afm]"
        );
        return EXIT_FAILURE;
    }

    const auto input_path = std::filesystem::path{arguments[1]};
    const auto latex_path = std::filesystem::path{arguments[2]};
    const auto pdf_path = std::filesystem::path{arguments[3]};
    const auto font_path = arguments.size() == 6U
                               ? std::filesystem::path{arguments[4]}
                               : std::filesystem::path{DANS_TYPESETTING_DEFAULT_LMR10_PFB};
    const auto metrics_path = arguments.size() == 6U
                                  ? std::filesystem::path{arguments[5]}
                                  : std::filesystem::path{DANS_TYPESETTING_DEFAULT_LMR10_AFM};

    const auto canonical = dans::document::transport::read_canonical_document(input_path);
    const auto document = make_materializer().materialize(canonical);
    make_latex_writer().write_file(document, latex_path);
    auto font = std::make_shared<const dans::document::fonts::Type1Font>(font_path, metrics_path);
    make_native_writer(font).write_file(document, pdf_path);
    std::println("Wrote LaTeX document: {}", latex_path.string());
    std::println("Wrote native PDF document: {}", pdf_path.string());
    return EXIT_SUCCESS;
}
}  // namespace

auto main(  // NOLINT(modernize-avoid-c-arrays): the hosted main signature is fixed.
    const int argc, char* argv[]
) noexcept -> int
{
    try
    {
        return run(std::span<char*>{argv, static_cast<std::size_t>(argc)});
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println(stderr, "Document publication failed: {}", error.what());
        }
        catch (...)
        {
            return EXIT_FAILURE;
        }
        return EXIT_FAILURE;
    }
    catch (...)
    {
        return EXIT_FAILURE;
    }
}
