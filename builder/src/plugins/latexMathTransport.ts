// Canonical transport codecs for source-authored LaTeX mathematics.
import type { BuilderBlock, BuilderInlineNode } from "../model/document";
import { decodeOptionalReferenceId } from "../model/referenceId";
import {
  requireTransportBoolean,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
  type InlineTransportCodec,
} from "../transport/documentTransport";
import {
  createLatexMathDisplay,
  createLatexMathInline,
  isLatexMathDisplay,
  isLatexMathInline,
  latexMathDisplayTypeId,
  latexMathInlineTypeId,
} from "./latexMathModel";

export const latexMathDisplayTransportCodec: BlockTransportCodec = {
  typeId: latexMathDisplayTypeId,
  encode(block) {
    if (!isLatexMathDisplay(block)) {
      throw new Error(`LaTeX display-math codec cannot encode ${block.typeId}`);
    }
    return {
      source: block.source,
      numbered: block.numbered,
      referenceId: block.referenceId,
    };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "LaTeX display-math payload");
    return createLatexMathDisplay(
      requireTransportString(data, "source", "LaTeX display-math payload"),
      requireTransportBoolean(data, "numbered", "LaTeX display-math payload"),
      decodeOptionalReferenceId(
        data.referenceId,
        "LaTeX display-math payload.referenceId",
      ),
      id,
    );
  },
};

export const latexMathInlineTransportCodec: InlineTransportCodec = {
  typeId: latexMathInlineTypeId,
  encode(inline) {
    if (!isLatexMathInline(inline)) {
      throw new Error(`LaTeX inline-math codec cannot encode ${inline.typeId}`);
    }
    return { source: inline.source };
  },
  decode(id, payload): BuilderInlineNode {
    const data = requireTransportRecord(payload, "LaTeX inline-math payload");
    return createLatexMathInline(
      requireTransportString(data, "source", "LaTeX inline-math payload"),
      id,
    );
  },
};
