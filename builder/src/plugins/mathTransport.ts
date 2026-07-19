// Canonical transport codecs owned by the structured-math plugin.
import {
  createMathInline,
  isMathDisplayBlock,
  isMathInline,
  mathDisplayTypeId,
  mathInlineTypeId,
  type BuilderBlock,
  type BuilderInlineNode,
} from "../model/document";
import {
  mathExpressionFromTransport,
  mathExpressionToTransport,
} from "../model/math";
import { decodeOptionalReferenceId } from "../model/referenceId";
import {
  requireTransportRecord,
  type BlockTransportCodec,
  type InlineTransportCodec,
} from "../transport/documentTransport";

export const displayMathTransportCodec: BlockTransportCodec = {
  typeId: mathDisplayTypeId,
  encode(block) {
    if (!isMathDisplayBlock(block)) {
      throw new Error(`Display-math codec cannot encode ${block.typeId}`);
    }
    return {
      expression: mathExpressionToTransport(block.expression),
      referenceId: block.referenceId,
    };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "Display-math payload");
    return Object.freeze({
      id,
      typeId: mathDisplayTypeId,
      expression: mathExpressionFromTransport(data.expression),
      referenceId: decodeOptionalReferenceId(
        data.referenceId,
        "Display-math payload.referenceId",
      ),
    });
  },
};

export const inlineMathTransportCodec: InlineTransportCodec = {
  typeId: mathInlineTypeId,
  encode(inline) {
    if (!isMathInline(inline)) {
      throw new Error(`Inline-math codec cannot encode ${inline.typeId}`);
    }
    return { expression: mathExpressionToTransport(inline.expression) };
  },
  decode(id, payload): BuilderInlineNode {
    const data = requireTransportRecord(payload, "Inline-math payload");
    return createMathInline(mathExpressionFromTransport(data.expression), id);
  },
};
