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

function requireLanguage(value: string): CodeListingLanguage {
  if (value !== "cpp" && value !== "julia") {
    throw new Error(`Unsupported code-listing language in transport: ${value}`);
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
      caption: requireTransportString(data, "caption", "Code-listing payload"),
    });
  },
};
