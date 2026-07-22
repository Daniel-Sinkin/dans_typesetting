// Assemble the focused writer-facing builder surface.
import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { BuilderPluginRegistry } from "../builder/plugin";
import {
  createHyperlinkInline,
  createReferenceInline,
  createText,
  MemoryDocumentPort,
  pageBreakTypeId,
  paragraphTypeId,
  sectionBodySequenceId,
  sectionTypeId,
  tableOfContentsTypeId,
  titlePageTypeId,
  type BuilderBlock,
} from "../model/document";
import {
  citationInlinePlugin,
} from "../plugins/bibliography";
import { colorSpanInlinePlugin } from "../plugins/colorSpan";
import { contentImagePlugin } from "../plugins/contentImage";
import { createContentImageBlock } from "../plugins/contentImageModel";
import { createCodeListingPlugin } from "../plugins/codeListing";
import { createCodeListingBlock } from "../plugins/codeListingModel";
import {
  pageBreakPlugin,
  sectionPlugin,
  tableOfContentsPlugin,
  titlePagePlugin,
} from "../plugins/documentShell";
import { excalidrawDrawingPlugin } from "../plugins/drawing";
import { excalidrawDrawingTypeId } from "../plugins/drawingModel";
import { createSampleExcalidrawScene } from "../plugins/drawingScene";
import { footnoteInlinePlugin } from "../plugins/footnote";
import { createFootnoteInline } from "../plugins/footnoteModel";
import { hyperlinkInlinePlugin } from "../plugins/hyperlink";
import { inlineCodePlugin } from "../plugins/inlineCode";
import { createInlineCode } from "../plugins/inlineCodeModel";
import { inlineImagePlugin } from "../plugins/inlineImage";
import {
  latexMathDisplayPlugin,
  latexMathInlinePlugin,
} from "../plugins/latexMath";
import {
  createLatexMathDisplay,
  createLatexMathInline,
} from "../plugins/latexMathModel";
import { opaqueBlockAdapter } from "../plugins/opaque";
import { createParagraphPlugin } from "../plugins/paragraph";
import { referenceInlinePlugin } from "../plugins/reference";
import { opaqueInlineAdapter, textInlinePlugin } from "../plugins/text";
import { projectDocumentTransport } from "../transport/projectTransport";
import { DocumentBuilder } from "./DocumentBuilder";

const inlinePluginRegistry = new BuilderInlinePluginRegistry(
  [
    textInlinePlugin,
    colorSpanInlinePlugin,
    latexMathInlinePlugin,
    hyperlinkInlinePlugin,
    referenceInlinePlugin,
    footnoteInlinePlugin,
    inlineCodePlugin,
    inlineImagePlugin,
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
    id: "sample-paragraph",
    typeId: paragraphTypeId,
    inlines: Object.freeze([
      createText("Write directly with ", "sample-paragraph-a"),
      createText("styled text", "sample-paragraph-style", "bold_italic"),
      createText(", a ", "sample-paragraph-b"),
      createHyperlinkInline(
        "https://en.wikipedia.org/",
        [createText("formatted hyperlink", "sample-link-label", "bold")],
        "sample-link",
      ),
      createText(", inline math ", "sample-paragraph-c"),
      createLatexMathInline(
        String.raw`x \leftarrow x^{2n + 1}`,
        "sample-inline-math",
      ),
      createText(", a reference to ", "sample-paragraph-d"),
      createReferenceInline("sec:interactive-blocks", "sample-reference"),
      createText(", inline code ", "sample-paragraph-e"),
      createInlineCode("cudaDeviceSynchronize()", "sample-inline-code"),
      createText(", and a footnote", "sample-paragraph-f"),
      createFootnoteInline(
        [createText("A semantic note edited from the same writing surface.")],
        "sample-footnote",
      ),
      createText(".", "sample-paragraph-g"),
    ]),
  }),
  createContentImageBlock(
    "sample-image",
    "/sample-domain-decomposition.svg",
    0.72,
  ),
  Object.freeze({
    id: "sample-excalidraw-drawing",
    typeId: excalidrawDrawingTypeId,
    caption: "An Excalidraw scene stored as semantic plugin data.",
    referenceId: null,
    widthFraction: 0.9,
    artboardHeight: 540,
    scene: createSampleExcalidrawScene(),
  }),
  createLatexMathDisplay(
    String.raw`\begin{aligned}
x_{n+1} &= x_n^{2n+1} \\
E &= T + V
\end{aligned}`,
    false,
    null,
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
  ),
] satisfies readonly BuilderBlock[];

const documentPort = new MemoryDocumentPort(initialBlocks);
const pluginRegistry = new BuilderPluginRegistry(
  [
    titlePagePlugin,
    tableOfContentsPlugin,
    pageBreakPlugin,
    sectionPlugin,
    createParagraphPlugin(inlinePluginRegistry),
    contentImagePlugin,
    excalidrawDrawingPlugin,
    latexMathDisplayPlugin,
    createCodeListingPlugin(inlinePluginRegistry),
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
