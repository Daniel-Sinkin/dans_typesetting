// builder/src/app/App.tsx — assemble the prototype document port and graphical adapters.
import { DocumentBuilder } from "./DocumentBuilder";
import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { BuilderPluginRegistry } from "../builder/plugin";
import {
  createParagraphText,
  createMathInline,
  createHyperlinkInline,
  codeListingTypeId,
  imageTypeId,
  MemoryDocumentPort,
  mathDisplayTypeId,
  paragraphTypeId,
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

const inlinePluginRegistry = new BuilderInlinePluginRegistry(
  [
    paragraphTextInlinePlugin,
    colorSpanInlinePlugin,
    createInlineMathPlugin(basicMathInputParser),
    hyperlinkInlinePlugin,
  ],
  opaqueInlineAdapter,
);

const initialBlocks = [
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
    ]),
  }),
  Object.freeze({
    id: "sample-figure",
    typeId: imageTypeId,
    source: "/sample-domain-decomposition.svg",
    caption: "A browser-rendered, captioned, referenceable image block.",
    widthFraction: 0.72,
    preferredPixelWidth: 1280,
    preferredPixelHeight: 720,
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
