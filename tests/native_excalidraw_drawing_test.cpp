// Verify the semantic drawing/LaTeX asset-resolver boundary.
#include "connectors/latex/excalidraw_drawing.hpp"
#include "document.hpp"
#include "plugins/excalidraw_drawing.hpp"
#include "reference_id.hpp"
#include "writers/latex_writer.hpp"

#include <cmath>
#include <exception>
#include <filesystem>
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
using dans::document::connectors::latex::ExcalidrawDrawingLatexAdapter;
using dans::document::plugins::DrawingWidth;
using dans::document::plugins::ExcalidrawDrawing;
using dans::document::writers::LatexWriter;

constexpr std::string_view k_scene =
    R"({"type":"excalidraw","version":2,"elements":[],"appState":{},"files":{}})";

auto expect(const bool condition, const std::string_view message) -> void
{
    if (!condition)
    {
        throw std::runtime_error{std::string{message}};
    }
}

auto expect_invalid(auto&& operation, const std::string_view message) -> void
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

auto render_drawing() -> std::string
{
    Document document;
    document.blocks().add<ExcalidrawDrawing>(
        k_scene,
        ReferenceId{"fig:drawing"},
        "A drawing with 50% & escaped text.",
        DrawingWidth::from_percent(72.0)
    );

    LatexWriter writer;
    writer.register_block_adapter(
        std::make_unique<ExcalidrawDrawingLatexAdapter>(
            [](const ExcalidrawDrawing& drawing)
            {
                expect(drawing.scene_json() == k_scene, "Asset resolver lost the semantic scene");
                return std::filesystem::path{"generated/drawing.pdf"};
            }
        )
    );
    std::ostringstream output;
    writer.serialize(document, output);
    return output.str();
}
}  // namespace

auto run_test() -> void
{
    const auto latex = render_drawing();
    expect(
        latex.contains("\\includegraphics[width=0.72\\linewidth]{generated/drawing.pdf}"),
        "Drawing width or resolved asset was not serialized"
    );
    expect(
        latex.contains(R"(\caption{A drawing with 50\% \& escaped text.})"),
        "Drawing caption was not escaped"
    );
    expect(latex.contains("\\label{fig:drawing}"), "Drawing reference ID was not serialized");
    expect(
        std::abs(DrawingWidth::from_fraction(0.4).fraction() - 0.4) < 1.0e-12,
        "Drawing width fraction changed"
    );

    expect_invalid(
        [] { static_cast<void>(DrawingWidth::from_fraction(0.0)); },
        "Zero drawing width was accepted"
    );
    expect_invalid(
        []
        {
            static_cast<void>(
                ExcalidrawDrawing{"", ReferenceId{"fig:empty"}, "Caption", DrawingWidth{}}
            );
        },
        "Empty drawing scene was accepted"
    );
    expect_invalid(
        [] { static_cast<void>(ExcalidrawDrawingLatexAdapter{{}}); },
        "Empty drawing asset resolver was accepted"
    );
}

auto main() noexcept -> int
{
    try
    {
        run_test();
        return 0;
    }
    catch (const std::exception& error)
    {
        try
        {
            std::println("native_excalidraw_drawing_test failed: {}", error.what());
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
