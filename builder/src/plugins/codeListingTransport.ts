// Canonical transport codec owned by the code-listing plugin.
import {
  codeListingTypeId,
  isCodeListingBlock,
  type BuilderBlock,
  type CodeListingLanguage,
} from "../model/document";
import {
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
} from "../transport/documentTransport";
import { decodeOptionalReferenceId } from "../model/referenceId";

function requireLanguage(value: string): CodeListingLanguage {
  if (
    value !== "cpp" &&
    value !== "cuda" &&
    value !== "julia" &&
    value !== "raw"
  ) {
    throw new Error(`Unsupported code-listing language in transport: ${value}`);
  }
  return value;
}

function decodeOptionalCaption(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Code-listing payload.caption must be a string or null");
  }
  return value;
}

export const codeListingBlockTransportCodec: BlockTransportCodec = {
  typeId: codeListingTypeId,
  encode(block) {
    if (!isCodeListingBlock(block)) {
      throw new Error(`Code-listing codec cannot encode ${block.typeId}`);
    }
    return {
      language: block.language,
      code: block.code,
      caption: block.caption,
      referenceId: block.referenceId,
    };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "Code-listing payload");
    return Object.freeze({
      id,
      typeId: codeListingTypeId,
      language: requireLanguage(
        requireTransportString(data, "language", "Code-listing payload"),
      ),
      code: requireTransportString(data, "code", "Code-listing payload"),
      caption: decodeOptionalCaption(data.caption),
      referenceId: decodeOptionalReferenceId(
        data.referenceId,
        "Code-listing payload.referenceId",
      ),
    });
  },
};
