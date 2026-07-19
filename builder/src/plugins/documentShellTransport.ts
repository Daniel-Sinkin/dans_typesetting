// Canonical codecs owned by document-shell and structural-section plugins.
import {
  isPageBreakBlock,
  isSectionBlock,
  isTableOfContentsBlock,
  isTitlePageBlock,
  pageBreakTypeId,
  sectionBody,
  sectionBodySequenceId,
  sectionTypeId,
  tableOfContentsTypeId,
  titlePageTypeId,
  type BuilderBlock,
} from "../model/document";
import {
  requireTransportArray,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
} from "../transport/documentTransport";

export const sectionBlockTransportCodec: BlockTransportCodec = {
  typeId: sectionTypeId,
  encode(block, registry) {
    if (!isSectionBlock(block)) {
      throw new Error(`Section codec cannot encode ${block.typeId}`);
    }
    return {
      title: block.title,
      referenceId: block.referenceId,
      blocks: sectionBody(block).map((child) => registry.encodeBlock(child)),
    };
  },
  decode(id, payload, registry): BuilderBlock {
    const data = requireTransportRecord(payload, "Section payload");
    const referenceId = data.referenceId;
    if (referenceId !== null && typeof referenceId !== "string") {
      throw new Error("Section payload.referenceId must be a string or null");
    }
    return Object.freeze({
      id,
      typeId: sectionTypeId,
      title: requireTransportString(data, "title", "Section payload"),
      referenceId,
      childSequences: Object.freeze([
        Object.freeze({
          id: sectionBodySequenceId,
          blocks: Object.freeze(
            requireTransportArray(data, "blocks", "Section payload").map(
              (child, index) =>
                registry.decodeBlock(child, `Section block ${String(index)}`),
            ),
          ),
        }),
      ]),
    });
  },
};

export const titlePageBlockTransportCodec: BlockTransportCodec = {
  typeId: titlePageTypeId,
  encode(block) {
    if (!isTitlePageBlock(block)) {
      throw new Error(`Title-page codec cannot encode ${block.typeId}`);
    }
    return { title: block.title, author: block.author, date: block.date };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "Title-page payload");
    return Object.freeze({
      id,
      typeId: titlePageTypeId,
      title: requireTransportString(data, "title", "Title-page payload"),
      author: requireTransportString(data, "author", "Title-page payload"),
      date: requireTransportString(data, "date", "Title-page payload"),
    });
  },
};

export const tableOfContentsBlockTransportCodec: BlockTransportCodec = {
  typeId: tableOfContentsTypeId,
  encode(block) {
    if (!isTableOfContentsBlock(block)) {
      throw new Error(`Table-of-contents codec cannot encode ${block.typeId}`);
    }
    return {};
  },
  decode(id, payload): BuilderBlock {
    requireTransportRecord(payload, "Table-of-contents payload");
    return Object.freeze({ id, typeId: tableOfContentsTypeId });
  },
};

export const pageBreakBlockTransportCodec: BlockTransportCodec = {
  typeId: pageBreakTypeId,
  encode(block) {
    if (!isPageBreakBlock(block)) {
      throw new Error(`Page-break codec cannot encode ${block.typeId}`);
    }
    return {};
  },
  decode(id, payload): BuilderBlock {
    requireTransportRecord(payload, "Page-break payload");
    return Object.freeze({ id, typeId: pageBreakTypeId });
  },
};
