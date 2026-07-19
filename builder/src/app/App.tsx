// builder/src/app/App.tsx — assemble the prototype document port and graphical adapters.
import { DocumentBuilder } from "./DocumentBuilder";
import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { BuilderPluginRegistry } from "../builder/plugin";
import {
  createText,
  createMathDisplayLine,
  createMathInline,
  createHyperlinkInline,
  createReferenceInline,
  MemoryDocumentPort,
  mathDisplayTypeId,
  paragraphTypeId,
  pageBreakTypeId,
  sectionTypeId,
  tableOfContentsTypeId,
  titlePageTypeId,
  type BuilderBlock,
} from "../model/document";
import {
  createMathBinary,
  createMathFraction,
  createMathIdentifier,
  createMathInteger,
  createMathNamedOperator,
  createMathRadical,
  createMathScript,
  createMathSummation,
  createMathSymbol,
  createMathStyledIdentifier,
  createMathText,
  createMathUnderbrace,
} from "../model/math";
import { createImagePlugin } from "../plugins/image";
import { createImageBlock } from "../plugins/imageModel";
import { createFigurePairPlugin } from "../plugins/figurePair";
import {
  createFigurePairBlock,
  createFigurePanel,
} from "../plugins/figurePairModel";
import { createCodeListingPlugin } from "../plugins/codeListing";
import { createCodeListingBlock } from "../plugins/codeListingModel";
import { createMathPlugin } from "../plugins/mathPlugin";
import { createInlineMathPlugin } from "../plugins/mathInline";
import { hyperlinkInlinePlugin } from "../plugins/hyperlink";
import { referenceInlinePlugin } from "../plugins/reference";
import { basicMathInputParser } from "../plugins/basicMathInputParser";
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
  createMathColumnVector,
  createMathMatrix,
  mathMatVecEditorExtension,
} from "../plugins/mathMatVec";

const inlinePluginRegistry = new BuilderInlinePluginRegistry(
  [
    textInlinePlugin,
    colorSpanInlinePlugin,
    createInlineMathPlugin(basicMathInputParser, [mathMatVecEditorExtension]),
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
    blocks: Object.freeze([]),
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
      createMathInline(
        createMathBinary(
          "approximately_equals",
          createMathIdentifier("E"),
          createMathBinary(
            "times",
            createMathIdentifier("m"),
            createMathScript(
              createMathIdentifier("c"),
              null,
              createMathInteger(2),
            ),
          ),
        ),
        "sample-introduction-inline-math",
      ),
      createText(
        " remains editable as structured inline mathematics. ",
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
      createMathInline(
        createMathScript(
          createMathIdentifier("J"),
          createMathInteger(2),
          null,
        ),
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
        createMathInline(
          createMathScript(
            createMathIdentifier("J"),
            createMathInteger(1),
            null,
          ),
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
        createMathInline(
          createMathBinary(
            "minus",
            createMathScript(
              createMathIdentifier("J"),
              createMathInteger(1),
              null,
            ),
            createMathScript(
              createMathIdentifier("J"),
              createMathInteger(2),
              null,
            ),
          ),
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
  Object.freeze({
    id: "sample-display-math",
    typeId: mathDisplayTypeId,
    alignment: "automatic",
    lines: Object.freeze([
      createMathDisplayLine(
        createMathBinary(
          "equals",
          createMathBinary(
            "minus",
            createMathBinary("plus", createMathInteger(1), createMathInteger(2)),
            createMathInteger(3),
          ),
          createMathSummation(
            createMathBinary(
              "equals",
              createMathIdentifier("i"),
              createMathInteger(1),
            ),
            createMathUnderbrace(
              createMathNamedOperator(
                "dim",
                createMathStyledIdentifier("H", "calligraphic"),
              ),
              createMathText("space dimension"),
            ),
            createMathBinary(
              "tensor_product",
              createMathMatrix([
                [createMathInteger(2), createMathInteger(4)],
                [createMathInteger(1), createMathInteger(3)],
              ]),
              createMathFraction(
                createMathColumnVector([
                  createMathIdentifier("x"),
                  createMathIdentifier("y"),
                ]),
                createMathRadical(
                  createMathScript(
                    createMathSymbol("lambda"),
                    createMathIdentifier("i"),
                    createMathInteger(2),
                  ),
                  createMathInteger(3),
                ),
              ),
            ),
          ),
        ),
        true,
        "eq:sample-summation",
        "sample-display-math-line-main",
      ),
      createMathDisplayLine(
        createMathBinary(
          "equals",
          createMathIdentifier("E"),
          createMathBinary(
            "plus",
            createMathIdentifier("T"),
            createMathIdentifier("V"),
          ),
        ),
        true,
        null,
        "sample-display-math-line-energy",
      ),
      createMathDisplayLine(
        createMathText("An intentionally unnumbered explanatory line"),
        false,
        null,
        "sample-display-math-line-note",
      ),
    ]),
  }),
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
        createMathInline(
          createMathBinary(
            "equals",
            createMathIdentifier("E"),
            createMathBinary(
              "times",
              createMathIdentifier("m"),
              createMathIdentifier("c"),
            ),
          ),
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
          createMathInline(
            createMathBinary(
              "times",
              createMathInteger(16),
              createMathInteger(16),
            ),
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
    createMathPlugin(basicMathInputParser, [mathMatVecEditorExtension]),
    createCodeListingPlugin(inlinePluginRegistry),
    titlePagePlugin,
    tableOfContentsPlugin,
    pageBreakPlugin,
    sectionPlugin,
    excalidrawDrawingPlugin,
    createItemListPlugin(inlinePluginRegistry),
    createTablePlugin(inlinePluginRegistry, tableCsvCapability),
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
