// Assemble canonical transport codecs without coupling the transport core to plugins.
import { codeListingBlockTransportCodec } from "../plugins/codeListingTransport";
import { colorSpanInlineTransportCodec } from "../plugins/colorSpanTransport";
import { hyperlinkInlineTransportCodec } from "../plugins/hyperlinkTransport";
import { imageBlockTransportCodec } from "../plugins/imageTransport";
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
  ],
  [
    paragraphTextInlineTransportCodec,
    colorSpanInlineTransportCodec,
    inlineMathTransportCodec,
    hyperlinkInlineTransportCodec,
  ],
);

export const projectDocumentTransport = new CanonicalDocumentTransport(
  projectTransportRegistry,
);
