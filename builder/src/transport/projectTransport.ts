// Assemble canonical transport codecs without coupling the transport core to plugins.
import { codeListingBlockTransportCodec } from "../plugins/codeListingTransport";
import { colorSpanInlineTransportCodec } from "../plugins/colorSpanTransport";
import { inlineCodeTransportCodec } from "../plugins/inlineCodeTransport";
import { hyperlinkInlineTransportCodec } from "../plugins/hyperlinkTransport";
import { referenceInlineTransportCodec } from "../plugins/referenceTransport";
import { footnoteInlineTransportCodec } from "../plugins/footnoteTransport";
import { imageBlockTransportCodec } from "../plugins/imageTransport";
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
  paragraphBlockTransportCodec,
  paragraphTextInlineTransportCodec,
} from "../plugins/paragraphTransport";
import {
  CanonicalDocumentTransport,
  DocumentTransportRegistry,
} from "./documentTransport";

export const projectTransportRegistry = new DocumentTransportRegistry(
  [
    paragraphBlockTransportCodec,
    imageBlockTransportCodec,
    displayMathTransportCodec,
    codeListingBlockTransportCodec,
    sectionBlockTransportCodec,
    titlePageBlockTransportCodec,
    tableOfContentsBlockTransportCodec,
    pageBreakBlockTransportCodec,
    excalidrawDrawingTransportCodec,
    itemListTransportCodec,
    tableTransportCodec,
  ],
  [
    paragraphTextInlineTransportCodec,
    colorSpanInlineTransportCodec,
    inlineMathTransportCodec,
    hyperlinkInlineTransportCodec,
    referenceInlineTransportCodec,
    footnoteInlineTransportCodec,
    inlineCodeTransportCodec,
  ],
);

export const projectDocumentTransport = new CanonicalDocumentTransport(
  projectTransportRegistry,
);
