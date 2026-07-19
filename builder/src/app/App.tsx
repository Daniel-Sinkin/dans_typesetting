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
  createMathIdentifier,
  createMathInteger,
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

const inlinePluginRegistry = new BuilderInlinePluginRegistry(
  [
    paragraphTextInlinePlugin,
    colorSpanInlinePlugin,
    createInlineMathPlugin(basicMathInputParser),
    hyperlinkInlinePlugin,
    referenceInlinePlugin,
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
            createMathIdentifier("c"),
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
        createMathBinary("times", createMathInteger(2), createMathInteger(4)),
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
  Object.freeze({
    id: "sample-opaque-table",
    typeId: "dans.future.table",
    opaquePayload: { rows: 3, columns: 2 },
  }),
  Object.freeze({
    id: "sample-conclusion",
    typeId: paragraphTypeId,
    inlines: Object.freeze([
      createParagraphText(
        "Alt-drag copies blocks. Ordinary dragging reorders them, and dropping outside the document asks before deletion.",
        "sample-conclusion-text",
      ),
    ]),
  }),
] satisfies readonly BuilderBlock[];

const documentPort = new MemoryDocumentPort(initialBlocks);
const pluginRegistry = new BuilderPluginRegistry(
  [
    createParagraphPlugin(inlinePluginRegistry),
    imagePlugin,
    createMathPlugin(basicMathInputParser),
    codeListingPlugin,
    titlePagePlugin,
    tableOfContentsPlugin,
    pageBreakPlugin,
    sectionPlugin,
    excalidrawDrawingPlugin,
    createItemListPlugin(inlinePluginRegistry),
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
