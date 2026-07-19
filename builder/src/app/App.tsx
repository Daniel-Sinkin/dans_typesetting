// builder/src/app/App.tsx — assemble the prototype document port and graphical adapters.
import { DocumentBuilder } from "./DocumentBuilder";
import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { BuilderPluginRegistry } from "../builder/plugin";
import {
  createText,
  createHyperlinkInline,
  createReferenceInline,
  MemoryDocumentPort,
  paragraphTypeId,
  pageBreakTypeId,
  sectionBodySequenceId,
  sectionTypeId,
  tableOfContentsTypeId,
  titlePageTypeId,
  type BuilderBlock,
} from "../model/document";
import { createImagePlugin } from "../plugins/image";
import { createImageBlock } from "../plugins/imageModel";
import { createFigurePairPlugin } from "../plugins/figurePair";
import {
  createFigurePairBlock,
  createFigurePanel,
} from "../plugins/figurePairModel";
import { createCodeListingPlugin } from "../plugins/codeListing";
import { createCodeListingBlock } from "../plugins/codeListingModel";
import { hyperlinkInlinePlugin } from "../plugins/hyperlink";
import { referenceInlinePlugin } from "../plugins/reference";
import { opaqueBlockAdapter } from "../plugins/opaque";
import { createParagraphPlugin } from "../plugins/paragraph";
import {
  opaqueInlineAdapter,
  textInlinePlugin,
} from "../plugins/text";
import {
  colorSpanInlinePlugin,
  createColorSpanInline,
} from "../plugins/colorSpan";
import { projectDocumentTransport } from "../transport/projectTransport";
import {
  pageBreakPlugin,
  sectionPlugin,
  tableOfContentsPlugin,
  titlePagePlugin,
} from "../plugins/documentShell";
import { excalidrawDrawingPlugin } from "../plugins/drawing";
import { excalidrawDrawingTypeId } from "../plugins/drawingModel";
import { createSampleExcalidrawScene } from "../plugins/drawingScene";
import { createItemListPlugin } from "../plugins/itemListPlugin";
import { createBuilderListItem, itemListTypeId } from "../plugins/itemListModel";
import { footnoteInlinePlugin } from "../plugins/footnote";
import { createInlineCode, inlineCodePlugin } from "../plugins/inlineCode";
import {
  citationInlinePlugin,
  createBibliographyBlock,
  createBibliographyEntry,
  createBibliographyPlugin,
  createCitationInline,
} from "../plugins/bibliography";
import { bibliographySourceCapability } from "../plugins/bibliographySources";
import { createFootnoteInline } from "../plugins/footnoteModel";
import { tableCsvCapability } from "../plugins/tableCsv";
import {
  createBuilderTableCell,
  createBuilderTableRow,
  createRichTableBlock,
} from "../plugins/tableModel";
import { createTablePlugin } from "../plugins/tablePlugin";
import {
  latexMathDisplayPlugin,
  latexMathInlinePlugin,
} from "../plugins/latexMath";
import {
  createLatexMathDisplay,
  createLatexMathInline,
} from "../plugins/latexMathModel";
import { paddingPlugin } from "../plugins/padding";
import { createPaddingBlock } from "../plugins/paddingModel";
import { createCaptionedPlugin } from "../plugins/captioned";
import { createCaptionedBlock } from "../plugins/captionedModel";
import { pythonPlotPlugin } from "../plugins/pythonPlot";
import { createPythonPlotBlock } from "../plugins/pythonPlotModel";
import { gridPlugin } from "../plugins/grid";
import { createGridBlock } from "../plugins/gridModel";

const inlinePluginRegistry = new BuilderInlinePluginRegistry(
  [
    textInlinePlugin,
    colorSpanInlinePlugin,
    latexMathInlinePlugin,
    hyperlinkInlinePlugin,
    referenceInlinePlugin,
    footnoteInlinePlugin,
    inlineCodePlugin,
    citationInlinePlugin,
  ],
  opaqueInlineAdapter,
);

const initialBlocks = [
  Object.freeze({
    id: "sample-title-page",
    typeId: titlePageTypeId,
    title: "Dan's Typesetting Experiment",
    author: "Daniel Sinkin",
    date: "19 July 2026",
  }),
  Object.freeze({
    id: "sample-table-of-contents",
    typeId: tableOfContentsTypeId,
  }),
  Object.freeze({
    id: "sample-page-break",
    typeId: pageBreakTypeId,
  }),
  Object.freeze({
    id: "sample-section",
    typeId: sectionTypeId,
    title: "Interactive document blocks",
    referenceId: "sec:interactive-blocks",
    childSequences: Object.freeze([
      Object.freeze({ id: sectionBodySequenceId, blocks: Object.freeze([]) }),
    ]),
  }),
  Object.freeze({
    id: "sample-introduction",
    typeId: paragraphTypeId,
    inlines: Object.freeze([
      createText(
        "This development rendering preserves an ordered inline sequence. ",
        "sample-introduction-text-a",
      ),
      createText(
        "Styled text",
        "sample-introduction-styled-text",
        "bold_italic",
      ),
      createText(" and ", "sample-introduction-text-link-join"),
      createHyperlinkInline(
        "https://example.com/typesetting",
        [
          createText(
            "clickable links",
            "sample-introduction-link-label",
            "bold",
          ),
        ],
        "sample-introduction-link",
      ),
      createText(" can sit beside ", "sample-introduction-text-math-join"),
      createLatexMathInline(
        String.raw`E \approx m c^2`,
        "sample-introduction-inline-math",
      ),
      createText(
        " remains editable as scoped LaTeX mathematics. ",
        "sample-introduction-text-b",
      ),
      createColorSpanInline(
        { red: 38, green: 96, blue: 168 },
        [
          createText(
            "Colour is supplied by a nested semantic inline plugin.",
            "sample-introduction-colour-text",
          ),
        ],
        "sample-introduction-colour",
      ),
      createText(" See ", "sample-introduction-reference-join"),
      createReferenceInline(
        "fig:domain-decomposition",
        "sample-introduction-reference",
      ),
      createText(" for the decomposition.", "sample-introduction-reference-tail"),
      createText(" Footnotes remain semantic", "sample-introduction-footnote-join"),
      createFootnoteInline(
        [
          createText(
            "This note has ",
            "sample-introduction-footnote-text",
          ),
          createHyperlinkInline(
            "https://example.com/footnotes",
            [
              createText(
                "a clickable source",
                "sample-introduction-footnote-link-label",
                "italic",
              ),
            ],
            "sample-introduction-footnote-link",
          ),
          createText(" in its inline sequence.", "sample-introduction-footnote-tail"),
        ],
        "sample-introduction-footnote",
      ),
      createText(".", "sample-introduction-footnote-period"),
      createText(" CUDA synchronization uses ", "sample-introduction-code-join"),
      createInlineCode(
        "cudaDeviceSynchronize()",
        "sample-introduction-inline-code",
      ),
      createText(".", "sample-introduction-code-period"),
      createText(
        " Prior tensor-network work ",
        "sample-introduction-citation-join",
      ),
      createCitationInline(
        ["verstraete2008", "orus2014"],
        "sample-introduction-citation",
      ),
      createText(
        " motivates this experiment.",
        "sample-introduction-citation-tail",
      ),
    ]),
  }),
  createImageBlock(
    "sample-figure",
    "/sample-domain-decomposition.svg",
    [
      createText(
        "A browser-rendered figure with ",
        "sample-figure-caption-text",
        "bold",
      ),
      createLatexMathInline(
        String.raw`J_2`,
        "sample-figure-caption-math",
      ),
      createColorSpanInline(
        { red: 38, green: 96, blue: 168 },
        [
          createText(
            " with colour",
            "sample-figure-caption-color-text",
          ),
        ],
        "sample-figure-caption-color",
      ),
      createText(
        " in its rich caption.",
        "sample-figure-caption-tail",
      ),
    ],
    "fig:domain-decomposition",
  ),
  createFigurePairBlock(
    "sample-figure-pair",
    createFigurePanel(
      "sample-figure-pair-left",
      "/sample-domain-decomposition.svg",
      [
        createText("Single-coupling model ", "sample-pair-left-text"),
        createLatexMathInline(
          String.raw`J_1`,
          "sample-pair-left-math",
        ),
      ],
      "fig:paired-models:left",
    ),
    createFigurePanel(
      "sample-figure-pair-right",
      "/sample-domain-decomposition.svg",
      [
        createText("Frustrated model ", "sample-pair-right-text"),
        createLatexMathInline(
          String.raw`J_1 - J_2`,
          "sample-pair-right-math",
        ),
      ],
      "fig:paired-models:right",
    ),
    [
      createText(
        "Side-by-side model comparison with independently referenceable panels.",
        "sample-pair-caption",
      ),
    ],
    "fig:paired-models",
  ),
  Object.freeze({
    id: "sample-excalidraw-drawing",
    typeId: excalidrawDrawingTypeId,
    caption: "An Excalidraw scene stored as semantic plugin data.",
    referenceId: "fig:embedded-drawing",
    widthFraction: 0.9,
    canvasHeight: 390,
    scene: createSampleExcalidrawScene(),
  }),
  createCaptionedBlock(
    "sample-captioned-plot",
    createPythonPlotBlock("sample-python-plot"),
    "Figure",
    [
      createText(
        "A live Matplotlib plot generated from editable Python source.",
        "sample-python-plot-caption",
      ),
    ],
    "fig:live-python-plot",
  ),
  createLatexMathDisplay(
    String.raw`\begin{aligned}
(1 + 2) - 3
  &= \sum_{i=1}^{\dim \mathcal{H}}
     \begin{pmatrix}2 & 4 \\ 1 & 3\end{pmatrix}
     \otimes
     \frac{\begin{pmatrix}x \\ y\end{pmatrix}}{\sqrt[3]{\lambda_i^2}} \\
E &= T + V
\end{aligned}`,
    true,
    "eq:sample-summation",
    "sample-display-math",
  ),
  createCodeListingBlock(
    "sample-code-listing",
    "cpp",
    [
      "#include <print>",
      "",
      "int main() {",
      "    std::println(\"Hello Typesetter!\");",
      "    return 0;",
      "}",
    ].join("\n"),
    [
      createText(
        "A selectable C++ block containing ",
        "sample-listing-caption-text",
      ),
      createInlineCode("std::println", "sample-listing-caption-code"),
      createText(".", "sample-listing-caption-tail"),
    ],
    "lst:hello-typesetter",
  ),
  Object.freeze({
    id: "sample-item-list",
    typeId: itemListTypeId,
    presentation: "enumerated",
    items: Object.freeze([
      createBuilderListItem("sample-list-item-contract", [
        createText(
          "Keep the semantic list contract small.",
          "sample-list-item-contract-text",
          "bold",
        ),
      ]),
      createBuilderListItem("sample-list-item-inline", [
        createText("Reuse ", "sample-list-item-inline-text-a"),
        createLatexMathInline(
          String.raw`E = mc`,
          "sample-list-item-inline-math",
        ),
        createText(
          " through the inline registry.",
          "sample-list-item-inline-text-b",
        ),
      ]),
      createBuilderListItem("sample-list-item-writer", [
        createText(
          "Let each writer choose bullets or numbering.",
          "sample-list-item-writer-text",
        ),
      ]),
    ]),
  }),
  createRichTableBlock(
    "sample-table",
    [createText("Representative kernel runtimes.", "sample-table-caption")],
    [
      createBuilderTableRow("sample-table-header", [
        createBuilderTableCell("sample-table-header-kernel", [
          createText("Kernel", "sample-table-header-kernel-text", "bold"),
        ]),
        createBuilderTableCell("sample-table-header-lattice", [
          createText("Lattice", "sample-table-header-lattice-text", "bold"),
        ]),
        createBuilderTableCell("sample-table-header-runtime", [
          createText("Runtime (ms)", "sample-table-header-runtime-text", "bold"),
        ]),
      ]),
      createBuilderTableRow("sample-table-contract", [
        createBuilderTableCell("sample-table-contract-kernel", [
          createText("contract", "sample-table-contract-kernel-text"),
        ]),
        createBuilderTableCell("sample-table-contract-lattice", [
          createLatexMathInline(
            String.raw`16 \times 16`,
            "sample-table-contract-lattice-math",
          ),
        ]),
        createBuilderTableCell("sample-table-contract-runtime", [
          createText("1.25", "sample-table-contract-runtime-text"),
          createFootnoteInline(
            [
              createText(
                "Median of ten measurements.",
                "sample-table-runtime-footnote-text",
              ),
            ],
            "sample-table-runtime-footnote",
          ),
        ]),
      ]),
      createBuilderTableRow("sample-table-svd", [
        createBuilderTableCell("sample-table-svd-kernel", [
          createText("svd", "sample-table-svd-kernel-text"),
        ]),
        createBuilderTableCell("sample-table-svd-lattice", [
          createText("32 × 32", "sample-table-svd-lattice-text"),
        ]),
        createBuilderTableCell("sample-table-svd-runtime", [
          createText("8.50", "sample-table-svd-runtime-text"),
        ]),
      ]),
    ],
    ["left", "center", "right"],
    1,
    "tab:kernel-runtime",
  ),
  Object.freeze({
    id: "sample-opaque-block",
    typeId: "dans.future.block",
    opaquePayload: { preserved: true },
  }),
  Object.freeze({
    id: "sample-conclusion",
    typeId: paragraphTypeId,
    inlines: Object.freeze([
      createText(
        "Alt-drag copies blocks. Ordinary dragging reorders them, and dropping outside the document asks before deletion. See ",
        "sample-conclusion-text",
      ),
      createReferenceInline("tab:kernel-runtime", "sample-conclusion-table-reference"),
      createText(" for the current measurements.", "sample-conclusion-tail"),
    ]),
  }),
  createPaddingBlock(
    "sample-padding",
    { topEm: 1.5, rightEm: 2, bottomEm: 1.5, leftEm: 2 },
    [
      Object.freeze({
        id: "sample-padding-paragraph",
        typeId: paragraphTypeId,
        inlines: Object.freeze([
          createText(
            "This paragraph is owned by a named nested content sequence.",
            "sample-padding-paragraph-text",
          ),
        ]),
      }),
    ],
  ),
  createGridBlock("sample-grid", 1, 2, {
    gaps: { rowEm: 1, columnEm: 1.5 },
    horizontalEdges: ["single", "single"],
    verticalEdges: ["single", "double", "single"],
    cells: [
      [
        Object.freeze({
          id: "sample-grid-left-paragraph",
          typeId: paragraphTypeId,
          inlines: Object.freeze([
            createText(
              "The left Grid cell owns an ordinary block sequence.",
              "sample-grid-left-text",
            ),
          ]),
        }),
      ],
      [
        createPaddingBlock(
          "sample-grid-right-padding",
          { topEm: 0.75, rightEm: 1, bottomEm: 0.75, leftEm: 1 },
          [
            Object.freeze({
              id: "sample-grid-right-paragraph",
              typeId: paragraphTypeId,
              inlines: Object.freeze([
                createText(
                  "The right cell demonstrates recursive Grid → Padding composition.",
                  "sample-grid-right-text",
                ),
              ]),
            }),
          ],
        ),
      ],
    ],
  }),
  createBibliographyBlock(
    [
      createBibliographyEntry({
        id: "sample-bibliography-verstraete",
        key: "verstraete2008",
        kind: "article",
        title:
          "Matrix product states, projected entangled pair states, and variational renormalization group methods for quantum spin systems",
        authors: ["Frank Verstraete", "J. Ignacio Cirac", "Valentin Murg"],
        year: 2008,
        venue: "Advances in Physics",
        doi: "10.1080/14789940801912366",
      }),
      createBibliographyEntry({
        id: "sample-bibliography-orus",
        key: "orus2014",
        kind: "article",
        title:
          "A practical introduction to tensor networks: Matrix product states and projected entangled pair states",
        authors: ["Roman Orús"],
        year: 2014,
        venue: "Annals of Physics",
        doi: "10.1016/j.aop.2014.06.013",
      }),
    ],
    "sample-bibliography",
  ),
] satisfies readonly BuilderBlock[];

const documentPort = new MemoryDocumentPort(initialBlocks);
const pluginRegistry = new BuilderPluginRegistry(
  [
    createParagraphPlugin(inlinePluginRegistry),
    createImagePlugin(inlinePluginRegistry),
    createFigurePairPlugin(inlinePluginRegistry),
    latexMathDisplayPlugin,
    createCodeListingPlugin(inlinePluginRegistry),
    titlePagePlugin,
    tableOfContentsPlugin,
    pageBreakPlugin,
    sectionPlugin,
    excalidrawDrawingPlugin,
    createItemListPlugin(inlinePluginRegistry),
    createTablePlugin(inlinePluginRegistry, tableCsvCapability),
    paddingPlugin,
    gridPlugin,
    pythonPlotPlugin,
    createCaptionedPlugin(
      inlinePluginRegistry,
      (blockId) => pythonPlotPlugin.createDefault(blockId),
    ),
    createBibliographyPlugin(bibliographySourceCapability),
  ],
  opaqueBlockAdapter,
);

export function App() {
  return (
    <DocumentBuilder
      port={documentPort}
      registry={pluginRegistry}
      transport={projectDocumentTransport}
    />
  );
}
