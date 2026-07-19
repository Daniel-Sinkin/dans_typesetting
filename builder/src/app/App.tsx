// builder/src/app/App.tsx — assemble the prototype document port and graphical adapters.
import { DocumentBuilder } from "./DocumentBuilder";
import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { BuilderPluginRegistry } from "../builder/plugin";
import {
  createParagraphText,
  createMathInline,
  createHyperlinkInline,
  createReferenceInline,
  codeListingTypeId,
  imageTypeId,
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
  createMathRadical,
  createMathScript,
  createMathSummation,
} from "../model/math";
import { imagePlugin } from "../plugins/image";
import { codeListingPlugin } from "../plugins/codeListing";
import { createMathPlugin } from "../plugins/mathPlugin";
import { createInlineMathPlugin } from "../plugins/mathInline";
import { hyperlinkInlinePlugin } from "../plugins/hyperlink";
import { referenceInlinePlugin } from "../plugins/reference";
import { basicMathInputParser } from "../plugins/basicMathInputParser";
import { opaqueBlockAdapter } from "../plugins/opaque";
import { createParagraphPlugin } from "../plugins/paragraph";
import {
  opaqueInlineAdapter,
  paragraphTextInlinePlugin,
} from "../plugins/paragraphInline";
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
    paragraphTextInlinePlugin,
    colorSpanInlinePlugin,
    createInlineMathPlugin(basicMathInputParser, [mathMatVecEditorExtension]),
    hyperlinkInlinePlugin,
    referenceInlinePlugin,
    footnoteInlinePlugin,
    inlineCodePlugin,
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
      createParagraphText(
        "This development rendering preserves an ordered inline sequence. ",
        "sample-introduction-text-a",
      ),
      createParagraphText(
        "Styled text",
        "sample-introduction-styled-text",
        "bold_italic",
      ),
      createParagraphText(" and ", "sample-introduction-text-link-join"),
      createHyperlinkInline(
        "https://example.com/typesetting",
        [
          createParagraphText(
            "clickable links",
            "sample-introduction-link-label",
            "bold",
          ),
        ],
        "sample-introduction-link",
      ),
      createParagraphText(" can sit beside ", "sample-introduction-text-math-join"),
      createMathInline(
        createMathBinary(
          "equals",
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
      createParagraphText(
        " remains editable as structured inline mathematics. ",
        "sample-introduction-text-b",
      ),
      createColorSpanInline(
        { red: 38, green: 96, blue: 168 },
        [
          createParagraphText(
            "Colour is supplied by a nested semantic inline plugin.",
            "sample-introduction-colour-text",
          ),
        ],
        "sample-introduction-colour",
      ),
      createParagraphText(" See ", "sample-introduction-reference-join"),
      createReferenceInline(
        "fig:domain-decomposition",
        "sample-introduction-reference",
      ),
      createParagraphText(" for the decomposition.", "sample-introduction-reference-tail"),
      createParagraphText(" Footnotes remain semantic", "sample-introduction-footnote-join"),
      createFootnoteInline(
        [
          createParagraphText(
            "This note has ",
            "sample-introduction-footnote-text",
          ),
          createHyperlinkInline(
            "https://example.com/footnotes",
            [
              createParagraphText(
                "a clickable source",
                "sample-introduction-footnote-link-label",
                "italic",
              ),
            ],
            "sample-introduction-footnote-link",
          ),
          createParagraphText(" in its inline sequence.", "sample-introduction-footnote-tail"),
        ],
        "sample-introduction-footnote",
      ),
      createParagraphText(".", "sample-introduction-footnote-period"),
      createParagraphText(" CUDA synchronization uses ", "sample-introduction-code-join"),
      createInlineCode(
        "cudaDeviceSynchronize()",
        "sample-introduction-inline-code",
      ),
      createParagraphText(".", "sample-introduction-code-period"),
    ]),
  }),
  Object.freeze({
    id: "sample-figure",
    typeId: imageTypeId,
    source: "/sample-domain-decomposition.svg",
    caption: "A browser-rendered, captioned, referenceable image block.",
    referenceId: "fig:domain-decomposition",
    widthFraction: 0.72,
    preferredPixelWidth: 1280,
    preferredPixelHeight: 720,
  }),
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
    expression: createMathBinary(
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
        createMathIdentifier("N"),
          createMathBinary(
            "times",
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
                createMathIdentifier("lambda"),
                createMathIdentifier("i"),
                createMathInteger(2),
              ),
              createMathInteger(3),
            ),
          ),
        ),
      ),
    ),
    referenceId: "eq:sample-summation",
  }),
  Object.freeze({
    id: "sample-code-listing",
    typeId: codeListingTypeId,
    language: "cpp",
    code: [
      "#include <print>",
      "",
      "int main() {",
      "    std::println(\"Hello Typesetter!\");",
      "    return 0;",
      "}",
    ].join("\n"),
    caption: "A selectable C++ source-code block.",
    referenceId: "lst:hello-typesetter",
  }),
  Object.freeze({
    id: "sample-item-list",
    typeId: itemListTypeId,
    presentation: "enumerated",
    items: Object.freeze([
      createBuilderListItem("sample-list-item-contract", [
        createParagraphText(
          "Keep the semantic list contract small.",
          "sample-list-item-contract-text",
          "bold",
        ),
      ]),
      createBuilderListItem("sample-list-item-inline", [
        createParagraphText("Reuse ", "sample-list-item-inline-text-a"),
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
        createParagraphText(
          " through the inline registry.",
          "sample-list-item-inline-text-b",
        ),
      ]),
      createBuilderListItem("sample-list-item-writer", [
        createParagraphText(
          "Let each writer choose bullets or numbering.",
          "sample-list-item-writer-text",
        ),
      ]),
    ]),
  }),
  createRichTableBlock(
    "sample-table",
    [createParagraphText("Representative kernel runtimes.", "sample-table-caption")],
    [
      createBuilderTableRow("sample-table-header", [
        createBuilderTableCell("sample-table-header-kernel", [
          createParagraphText("Kernel", "sample-table-header-kernel-text", "bold"),
        ]),
        createBuilderTableCell("sample-table-header-lattice", [
          createParagraphText("Lattice", "sample-table-header-lattice-text", "bold"),
        ]),
        createBuilderTableCell("sample-table-header-runtime", [
          createParagraphText("Runtime (ms)", "sample-table-header-runtime-text", "bold"),
        ]),
      ]),
      createBuilderTableRow("sample-table-contract", [
        createBuilderTableCell("sample-table-contract-kernel", [
          createParagraphText("contract", "sample-table-contract-kernel-text"),
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
          createParagraphText("1.25", "sample-table-contract-runtime-text"),
          createFootnoteInline(
            [
              createParagraphText(
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
          createParagraphText("svd", "sample-table-svd-kernel-text"),
        ]),
        createBuilderTableCell("sample-table-svd-lattice", [
          createParagraphText("32 × 32", "sample-table-svd-lattice-text"),
        ]),
        createBuilderTableCell("sample-table-svd-runtime", [
          createParagraphText("8.50", "sample-table-svd-runtime-text"),
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
      createParagraphText(
        "Alt-drag copies blocks. Ordinary dragging reorders them, and dropping outside the document asks before deletion. See ",
        "sample-conclusion-text",
      ),
      createReferenceInline("tab:kernel-runtime", "sample-conclusion-table-reference"),
      createParagraphText(" for the current measurements.", "sample-conclusion-tail"),
    ]),
  }),
] satisfies readonly BuilderBlock[];

const documentPort = new MemoryDocumentPort(initialBlocks);
const pluginRegistry = new BuilderPluginRegistry(
  [
    createParagraphPlugin(inlinePluginRegistry),
    imagePlugin,
    createMathPlugin(basicMathInputParser, [mathMatVecEditorExtension]),
    codeListingPlugin,
    titlePagePlugin,
    tableOfContentsPlugin,
    pageBreakPlugin,
    sectionPlugin,
    excalidrawDrawingPlugin,
    createItemListPlugin(inlinePluginRegistry),
    createTablePlugin(inlinePluginRegistry, tableCsvCapability),
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
