// Assemble canonical transport codecs without coupling the transport core to plugins.
import { codeListingBlockTransportCodec } from "../plugins/codeListingTransport";
import { colorSpanInlineTransportCodec } from "../plugins/colorSpanTransport";
import { inlineCodeTransportCodec } from "../plugins/inlineCodeTransport";
import { inlineImageTransportCodec } from "../plugins/inlineImageTransport";
import {
  bibliographyBlockTransportCodec,
  citationInlineTransportCodec,
} from "../plugins/bibliographyTransport";
import { hyperlinkInlineTransportCodec } from "../plugins/hyperlinkTransport";
import { referenceInlineTransportCodec } from "../plugins/referenceTransport";
import { footnoteInlineTransportCodec } from "../plugins/footnoteTransport";
import { imageBlockTransportCodec } from "../plugins/imageTransport";
import { figurePairTransportCodec } from "../plugins/figurePairTransport";
import { excalidrawDrawingTransportCodec } from "../plugins/drawingTransport";
import { itemListTransportCodec } from "../plugins/itemListTransport";
import { tableTransportCodec } from "../plugins/tableTransport";
import {
  pageBreakBlockTransportCodec,
  sectionBlockTransportCodec,
  tableOfContentsBlockTransportCodec,
  titlePageBlockTransportCodec,
} from "../plugins/documentShellTransport";
import {
  displayMathTransportCodec,
  inlineMathTransportCodec,
} from "../plugins/mathTransport";
import {
  latexMathDisplayTransportCodec,
  latexMathInlineTransportCodec,
} from "../plugins/latexMathTransport";
import { paragraphBlockTransportCodec } from "../plugins/paragraphTransport";
import { paddingTransportCodec } from "../plugins/paddingTransport";
import { captionedTransportCodec } from "../plugins/captionedTransport";
import { pythonPlotTransportCodec } from "../plugins/pythonPlotTransport";
import { gridTransportCodec } from "../plugins/gridTransport";
import { textInlineTransportCodec } from "../plugins/textTransport";
import {
  CanonicalDocumentTransport,
  DocumentTransportRegistry,
} from "./documentTransport";

export const projectTransportRegistry = new DocumentTransportRegistry(
  [
    paragraphBlockTransportCodec,
    imageBlockTransportCodec,
    figurePairTransportCodec,
    displayMathTransportCodec,
    latexMathDisplayTransportCodec,
    codeListingBlockTransportCodec,
    sectionBlockTransportCodec,
    titlePageBlockTransportCodec,
    tableOfContentsBlockTransportCodec,
    pageBreakBlockTransportCodec,
    excalidrawDrawingTransportCodec,
    itemListTransportCodec,
    tableTransportCodec,
    paddingTransportCodec,
    captionedTransportCodec,
    pythonPlotTransportCodec,
    gridTransportCodec,
    bibliographyBlockTransportCodec,
  ],
  [
    textInlineTransportCodec,
    colorSpanInlineTransportCodec,
    inlineMathTransportCodec,
    latexMathInlineTransportCodec,
    hyperlinkInlineTransportCodec,
    referenceInlineTransportCodec,
    footnoteInlineTransportCodec,
    inlineCodeTransportCodec,
    inlineImageTransportCodec,
    citationInlineTransportCodec,
  ],
);

export const projectDocumentTransport = new CanonicalDocumentTransport(
  projectTransportRegistry,
);
