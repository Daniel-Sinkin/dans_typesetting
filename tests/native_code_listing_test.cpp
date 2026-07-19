// Verify semantic listing modes, optional metadata, and LaTeX lowering.
#include "connectors/latex/code_listing.hpp"
#include "connectors/latex/core_paragraph.hpp"
#include "document.hpp"
#include "plugins/code_listing.hpp"
#include "reference_id.hpp"
#include "writers/latex_writer.hpp"

#include <exception>
#include <memory>
#include <print>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>

namespace
{
using dans::document::Document;
using dans::document::ReferenceId;
using dans::document::connectors::latex::CodeListingLatexAdapter;
using dans::document::connectors::latex::CoreParagraphInlineLatexRenderer;
using dans::document::connectors::latex::CoreTextLatexAdapter;
using dans::document::plugins::CodeLanguage;
using dans::document::plugins::CodeListing;
using dans::document::writers::LatexWriter;

auto expect(const bool condition, const std::string_view message) -> void
{
    if (!condition)
    {
        throw std::runtime_error{std::string{message}};
    }
}

template <typename Operation>
auto expect_rejected(Operation&& operation, const std::string_view message) -> void
{
    auto rejected = false;
    try
    {
        operation();
    }
    catch (const std::exception&)
    {
        rejected = true;
    }
    expect(rejected, message);
}

auto make_writer() -> LatexWriter
{
    auto renderer = std::make_shared<CoreParagraphInlineLatexRenderer>();
    renderer->register_inline_adapter(std::make_unique<CoreTextLatexAdapter>());
    LatexWriter writer;
    writer.register_block_adapter(std::make_unique<CodeListingLatexAdapter>(renderer));
    return writer;
}

auto test_semantic_contract() -> void
{
    const CodeListing raw{CodeLanguage::raw, "plain text\nwith no metadata"};
    expect(!raw.reference_id().has_value(), "A raw listing acquired a reference target");
    expect(!raw.has_caption(), "A raw listing acquired a caption");

    const CodeListing captioned{CodeLanguage::julia, "x = 1", "Caption only"};
    expect(!captioned.reference_id().has_value(), "A caption-only listing acquired a target");
    expect(captioned.has_caption(), "A caption-only listing lost its caption");

    const CodeListing referenced{
        CodeLanguage::cuda, "__global__ void kernel() {}", ReferenceId{"lst:kernel"}
    };
    expect(referenced.reference_id().has_value(), "A reference-only listing lost its target");
    expect(!referenced.has_caption(), "A reference-only listing acquired a caption");

    expect_rejected(
        [] { static_cast<void>(CodeListing{CodeLanguage::cpp, ""}); },
        "An empty listing was accepted"
    );
    expect_rejected(
        [] { static_cast<void>(CodeListing{CodeLanguage::cpp, "x", std::string_view{}}); },
        "An explicitly empty caption was accepted"
    );
}

auto test_latex() -> void
{
    Document document;
    document.blocks().add<CodeListing>(
        CodeLanguage::cpp, "constexpr int answer = 42;", ReferenceId{"lst:answer"}, "C++ & caption"
    );
    document.blocks().add<CodeListing>(
        CodeLanguage::cuda,
        "__global__ void scale(float* x) { x[threadIdx.x] *= 2.0F; }",
        ReferenceId{"lst:scale"}
    );
    document.blocks().add<CodeListing>(CodeLanguage::julia, "energy(x) = sum(abs2, x)", "Julia");
    document.blocks().add<CodeListing>(CodeLanguage::raw, "unclassified = bytes");

    auto writer = make_writer();
    std::ostringstream output;
    writer.serialize(document, output);
    const auto rendered = output.str();

    expect(rendered.contains("\\lstdefinelanguage{CUDA}[]{C++}"), "CUDA language was not defined");
    expect(
        rendered.contains(
            "\\begin{lstlisting}[language={C++},caption={C++ \\& caption},label={lst:answer}]"
        ),
        "Captioned and referenced C++ metadata was not lowered"
    );
    expect(
        rendered.contains(
            "\\refstepcounter{lstlisting}\n\\label{lst:scale}\n"
            "\\begin{lstlisting}[language={CUDA}]"
        ),
        "Captionless CUDA numbering or reference lowering changed"
    );
    expect(
        rendered.contains("\\begin{lstlisting}[language={Julia},caption={Julia}]"),
        "Caption-only Julia metadata was not lowered"
    );
    expect(
        rendered.contains("\\refstepcounter{lstlisting}\n\\begin{lstlisting}\nunclassified"),
        "Raw listing unexpectedly selected a language or lost writer numbering"
    );

    expect_rejected(
        [&writer]
        {
            Document invalid;
            invalid.blocks().add<CodeListing>(CodeLanguage::raw, "\\end{lstlisting}");
            std::ostringstream sink;
            writer.serialize(invalid, sink);
        },
        "A listing containing the environment terminator was rendered"
    );
}
}  // namespace

auto main() noexcept -> int
{
    try
    {
        test_semantic_contract();
        test_latex();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_code_listing_test failed: {}", error.what());
        }
        catch (...)
        {
            return 1;
        }
        return 1;
    }
    catch (...)
    {
        return 1;
    }
}
