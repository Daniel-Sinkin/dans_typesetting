// Canonical transport codec owned by the code-listing plugin.
import { createText, type BuilderBlock } from "../model/document";
import { decodeOptionalReferenceId } from "../model/referenceId";
import {
  requireTransportArray,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
  type DocumentTransportRegistry,
} from "../transport/documentTransport";
import {
  codeListingTypeId,
  createCodeListingBlock,
  type CodeListingLanguage,
} from "./codeListingModel";
import { requireCodeListing } from "./codeListingSupport";

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

function decodeCaption(
  blockId: string,
  data: Readonly<Record<string, unknown>>,
  registry: DocumentTransportRegistry,
) {
  const hasRichCaption = "captionInlines" in data;
  const hasLegacyCaption = "caption" in data;
  if (hasRichCaption && hasLegacyCaption) {
    throw new Error(
      "Code-listing payload requires exactly one of captionInlines or legacy caption",
    );
  }
  if (!hasRichCaption && !hasLegacyCaption) {
    return null;
  }
  if (hasRichCaption) {
    if (data.captionInlines === null) {
      return null;
    }
    return requireTransportArray(
      data,
      "captionInlines",
      "Code-listing payload",
    ).map((inline, index) =>
      registry.decodeInline(
        inline,
        `Code-listing caption inline ${String(index)}`,
      ),
    );
  }
  if (data.caption === null || data.caption === undefined) {
    return null;
  }
  const caption = requireTransportString(
    data,
    "caption",
    "Code-listing payload",
  );
  if (caption.trim().length === 0) {
    throw new Error("Legacy code-listing payload.caption must not be empty");
  }
  return [createText(caption, `${blockId}:caption:legacy-text`)];
}

export const codeListingBlockTransportCodec: BlockTransportCodec = {
  typeId: codeListingTypeId,
  encode(block, registry) {
    const listing = requireCodeListing(block);
    return {
      language: listing.language,
      code: listing.code,
      captionInlines:
        listing.captionInlines === null
          ? null
          : listing.captionInlines.map((inline) => registry.encodeInline(inline)),
      referenceId: listing.referenceId,
    };
  },
  decode(id, payload, registry): BuilderBlock {
    const data = requireTransportRecord(payload, "Code-listing payload");
    return createCodeListingBlock(
      id,
      requireLanguage(
        requireTransportString(data, "language", "Code-listing payload"),
      ),
      requireTransportString(data, "code", "Code-listing payload"),
      decodeCaption(id, data, registry),
      decodeOptionalReferenceId(
        data.referenceId,
        "Code-listing payload.referenceId",
      ),
    );
  },
};
