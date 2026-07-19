// Canonical transport codecs owned by the structured-math plugin.
import {
  createMathDisplayLine,
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
  requireTransportArray,
  requireTransportRecord,
  requireTransportString,
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
      alignment: block.alignment,
      lines: block.lines.map((line) => ({
        id: line.id,
        expression: mathExpressionToTransport(line.expression),
        numbered: line.numbered,
        referenceId: line.referenceId,
      })),
    };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "Display-math payload");
    if ("lines" in data) {
      if ("expression" in data || "referenceId" in data) {
        throw new Error(
          "Display-math payload cannot mix ordered lines with legacy expression fields",
        );
      }
      const alignment = data.alignment ?? "automatic";
      if (alignment !== "automatic" && alignment !== "disabled") {
        throw new Error(
          "Display-math payload.alignment must be 'automatic' or 'disabled'",
        );
      }
      const lines = requireTransportArray(
        data,
        "lines",
        "Display-math payload",
      ).map((value, index) => {
        const context = `Display-math payload.lines[${String(index)}]`;
        const line = requireTransportRecord(value, context);
        const numbered = line.numbered;
        if (typeof numbered !== "boolean") {
          throw new Error(`${context}.numbered must be a boolean`);
        }
        return createMathDisplayLine(
          mathExpressionFromTransport(line.expression),
          numbered,
          decodeOptionalReferenceId(line.referenceId, `${context}.referenceId`),
          requireTransportString(line, "id", context),
        );
      });
      if (lines.length === 0) {
        throw new Error("Display-math payload.lines cannot be empty");
      }
      return Object.freeze({
        id,
        typeId: mathDisplayTypeId,
        alignment,
        lines: Object.freeze(lines),
      });
    }

    if (data.alignment !== undefined) {
      throw new Error(
        "A legacy display-math payload cannot provide alignment without ordered lines",
      );
    }
    return Object.freeze({
      id,
      typeId: mathDisplayTypeId,
      alignment: "automatic",
      lines: Object.freeze([
        createMathDisplayLine(
          mathExpressionFromTransport(data.expression),
          true,
          decodeOptionalReferenceId(
            data.referenceId,
            "Display-math payload.referenceId",
          ),
          `${id}:line:0`,
        ),
      ]),
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
