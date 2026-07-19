// Verify normalized bibliography data and its LaTeX composition boundary.
#include "connectors/latex/bibliography.hpp"
#include "connectors/latex/core_paragraph.hpp"
#include "document.hpp"
#include "plugins/bibliography.hpp"
#include "plugins/bibliography_bibtex.hpp"
#include "plugins/bibliography_json.hpp"
#include "plugins/core_paragraph.hpp"
#include "writers/latex_writer.hpp"

#include <exception>
#include <filesystem>
#include <memory>
#include <print>
#include <sstream>
#include <stdexcept>
#include <string>

#ifndef DANS_TYPESETTING_BIBLIOGRAPHY_TEST_OUTPUT
#    error "DANS_TYPESETTING_BIBLIOGRAPHY_TEST_OUTPUT must identify a build-tree test output"
#endif

namespace
{
auto expect(const bool condition, const std::string_view message) -> void
{
    if (!condition)
    {
        throw std::runtime_error{std::string{message}};
    }
}

auto expect_rejected(auto&& operation, const std::string_view message) -> void
{
    try
    {
        operation();
    }
    catch (const std::invalid_argument&)
    {
        return;
    }
    throw std::runtime_error{std::string{message}};
}

auto test_model() -> void
{
    using namespace dans::document::plugins;

    Bibliography bibliography;
    auto& article = bibliography.add_entry(
        CitationKey{"verstraete2008"},
        BibliographyEntryKind::article,
        "Matrix product states, projected entangled pair states, and variational renormalization",
        {"Frank Verstraete", "J. Ignacio Cirac", "Valentin Murg"}
    );
    article.set_year(2008)
        .set_venue("Advances in Physics")
        .set_doi("10.1080/14789940801912366")
        .set_url("https://example.com/paper?part=1&format=pdf");

    expect(bibliography.entries().size() == 1, "A bibliography entry was not retained");
    expect(article.authors().size() == 3, "Bibliography authors lost their order");
    expect(article.year() == 2008, "A bibliography year was not retained");

    Citation multiple{CitationKey{"verstraete2008"}, CitationKey{"schollwoeck2011"}};
    expect(multiple.keys().size() == 2, "A multi-citation lost a key");

    expect_rejected(
        [] { [[maybe_unused]] CitationKey key{"3invalid"}; }, "An invalid citation key was accepted"
    );
    expect_rejected(
        [&bibliography]
        {
            bibliography.add_entry(
                CitationKey{"verstraete2008"}, BibliographyEntryKind::article, "Duplicate"
            );
        },
        "A duplicate bibliography key was accepted"
    );
    expect_rejected(
        [] { [[maybe_unused]] Citation duplicate{CitationKey{"same"}, CitationKey{"same"}}; },
        "A repeated key in one citation was accepted"
    );
}

auto test_latex() -> void
{
    using namespace dans::document;
    using namespace dans::document::plugins;

    Document document;
    auto& paragraph = document.blocks().add<CoreParagraph>();
    paragraph.append_text("Tensor networks are reviewed in ");
    paragraph.inlines().add<Citation>(
        std::initializer_list<CitationKey>{CitationKey{"verstraete2008"}, CitationKey{"orus2014"}}
    );
    paragraph.append_text(".");

    auto& bibliography = document.blocks().add<Bibliography>();
    bibliography
        .add_entry(
            CitationKey{"verstraete2008"},
            BibliographyEntryKind::article,
            "Matrix product states & PEPS",
            {"Frank Verstraete", "J. Ignacio Cirac"}
        )
        .set_year(2008)
        .set_venue("Advances in Physics")
        .set_doi("10.1080/14789940801912366");
    bibliography
        .add_entry(
            CitationKey{"orus2014"},
            BibliographyEntryKind::article,
            "A practical introduction to tensor networks",
            {"Roman Orus"}
        )
        .set_year(2014)
        .set_url("https://example.com/tensor_networks?format=pdf&lang=en");

    auto inline_renderer = std::make_shared<connectors::latex::CoreParagraphInlineLatexRenderer>();
    inline_renderer->register_inline_adapter(
        std::make_unique<connectors::latex::CoreTextLatexAdapter>()
    );
    inline_renderer->register_inline_adapter(
        std::make_unique<connectors::latex::CitationLatexAdapter>()
    );
    writers::LatexWriter writer;
    writer.register_block_adapter(
        std::make_unique<connectors::latex::CoreParagraphLatexAdapter>(inline_renderer)
    );
    writer.register_block_adapter(std::make_unique<connectors::latex::BibliographyLatexAdapter>());

    std::ostringstream output;
    writer.serialize(document, output);
    const auto rendered = output.str();
    expect(
        rendered.contains(R"(\cite{verstraete2008,orus2014})"),
        "A semantic multi-citation was not lowered"
    );
    expect(rendered.contains(R"(\bibitem{verstraete2008})"), "A bibliography key was not lowered");
    expect(
        rendered.contains(R"(\textit{Matrix product states \& PEPS})"),
        "Bibliography text was not escaped"
    );
    expect(
        rendered.contains(
            R"(\href{https://doi.org/10.1080/14789940801912366}{doi:10.1080/14789940801912366})"
        ),
        "A DOI did not become a working hyperlink"
    );
    expect(
        rendered.contains(
            R"(\href{https://example.com/tensor\_networks?format=pdf\&lang=en}{https://example.com/tensor\_networks?format=pdf\&lang=en})"
        ),
        "A bibliography URL was not escaped and linked"
    );
}

auto populate_source_bibliography(dans::document::plugins::Bibliography& bibliography) -> void
{
    using namespace dans::document::plugins;

    bibliography
        .add_entry(
            CitationKey{"Verstraete2008"},
            BibliographyEntryKind::article,
            "Matrix product states and projected entangled pair states",
            {"Frank Verstraete", "Valentin Murg", "J. Ignacio Cirac"}
        )
        .set_year(2008)
        .set_venue("Advances in Physics")
        .set_publisher("Taylor & Francis")
        .set_doi("10.1080/14789940801912366")
        .set_url("https://example.com/paper");
    bibliography
        .add_entry(
            CitationKey{"CudaGuide"},
            BibliographyEntryKind::web,
            "CUDA C++ Programming Guide",
            {"NVIDIA"}
        )
        .set_year(2026)
        .set_venue("NVIDIA documentation")
        .set_url("https://docs.nvidia.com/cuda/cuda-c-programming-guide/");
}

auto test_sources() -> void
{
    using namespace dans::document::plugins;

    Bibliography bibliography;
    populate_source_bibliography(bibliography);
    const auto json = serialize_bibliography_json(bibliography);
    Bibliography json_restored;
    import_bibliography_json(json_restored, json);
    expect(
        serialize_bibliography_json(json_restored) == json,
        "The bespoke bibliography JSON projection was not idempotent"
    );
    expect(json.contains("dans.typesetting.bibliography"), "JSON omitted its format marker");
    const auto json_path = std::filesystem::path{DANS_TYPESETTING_BIBLIOGRAPHY_TEST_OUTPUT};
    write_bibliography_json_file(bibliography, json_path);
    Bibliography json_file_restored;
    import_bibliography_json_file(json_file_restored, json_path);
    expect(
        serialize_bibliography_json(json_file_restored) == json,
        "The bibliography JSON file seam changed normalized data"
    );

    const auto bibtex = serialize_bibliography_bibtex(bibliography);
    Bibliography bibtex_restored;
    import_bibliography_bibtex(bibtex_restored, bibtex);
    expect(
        serialize_bibliography_bibtex(bibtex_restored) == bibtex,
        "The supported BibTeX projection was not semantically idempotent"
    );
    expect(bibtex.contains("@article{Verstraete2008"), "BibTeX lost an article kind");
    expect(bibtex.contains("@online{CudaGuide"), "BibTeX lost a web kind");
    auto bibtex_path = json_path;
    bibtex_path.replace_extension(".bib");
    write_bibliography_bibtex_file(bibliography, bibtex_path);
    Bibliography bibtex_file_restored;
    import_bibliography_bibtex_file(bibtex_file_restored, bibtex_path);
    expect(
        serialize_bibliography_bibtex(bibtex_file_restored) == bibtex,
        "The BibTeX file seam changed normalized data"
    );

    const auto grouped = parse_bibliography_bibtex(
        "% external source\r\n"
        "@article{Grouped,\r\n"
        "  author = \"Ada Lovelace and Grace Hopper\",\r\n"
        "  title = {A {GPU} Result},\r\n"
        "  journal = \"Journal of {HPC}\",\r\n"
        "  year = 2025\r\n"
        "}\r\n"
    );
    expect(grouped.size() == 1, "BibTeX grouping fixture lost its entry");
    expect(grouped.front().title() == "A GPU Result", "BibTeX grouping leaked into the title");
    expect(grouped.front().venue() == "Journal of HPC", "BibTeX grouping leaked into the venue");
    expect(grouped.front().authors().size() == 2, "BibTeX author splitting failed");

    expect_rejected(
        [] { static_cast<void>(parse_bibliography_bibtex("@string{journal={Physics}}")); },
        "A BibTeX string macro was silently accepted"
    );
    expect_rejected(
        [] { static_cast<void>(parse_bibliography_bibtex("@article{A,title={A} # {B}}")); },
        "BibTeX value concatenation was silently accepted"
    );
    expect_rejected(
        [] { static_cast<void>(parse_bibliography_bibtex("@software{A,title={Code}}")); },
        "An unsupported BibTeX entry kind was silently accepted"
    );
    expect_rejected(
        [] { static_cast<void>(parse_bibliography_bibtex("@article{A,title=titleMacro}")); },
        "A bare BibTeX string macro was silently accepted"
    );
    expect_rejected(
        []
        {
            static_cast<void>(
                parse_bibliography_bibtex("@article{Same,title={One}}\n@book{Same,title={Two}}")
            );
        },
        "Duplicate BibTeX citation keys were accepted"
    );
    expect_rejected(
        [] { static_cast<void>(parse_bibliography_bibtex("@article{A,title={\\LaTeX}}")); },
        "A LaTeX command in normalized BibTeX text was silently accepted"
    );
    expect_rejected(
        []
        {
            static_cast<void>(
                parse_bibliography_json(R"({"format":"wrong","schemaVersion":1,"entries":[]})")
            );
        },
        "An incompatible bibliography JSON format was accepted"
    );
    expect_rejected(
        []
        {
            static_cast<void>(parse_bibliography_json(
                R"({"format":"dans.typesetting.bibliography","schemaVersion":1,"entries":[{"key":"Same","kind":"article","title":"One","authors":[],"year":null,"venue":null,"publisher":null,"doi":null,"url":null},{"key":"Same","kind":"book","title":"Two","authors":[],"year":null,"venue":null,"publisher":null,"doi":null,"url":null}]})"
            ));
        },
        "Duplicate bibliography JSON citation keys were accepted"
    );
}
}  // namespace

auto main() noexcept -> int
{
    try
    {
        test_model();
        test_latex();
        test_sources();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_bibliography_test failed: {}", error.what());
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
