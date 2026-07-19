// Versioned canonical document transport with plugin-owned payload codecs.
import {
  MemoryDocumentPort,
  type BuilderBlock,
  type BuilderInlineNode,
  type DocumentMetadata,
  type DocumentSnapshot,
} from "../model/document";

export const canonicalDocumentFormat = "dans.typesetting.document";
export const canonicalDocumentSchemaVersion = 1;

export interface CanonicalNodeEnvelope {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
}

export interface DecodedDocumentTransport {
  readonly metadata: DocumentMetadata;
  readonly blocks: readonly BuilderBlock[];
}

export interface BlockTransportCodec {
  readonly typeId: string;
  encode(block: BuilderBlock, registry: DocumentTransportRegistry): unknown;
  decode(
    id: string,
    payload: unknown,
    registry: DocumentTransportRegistry,
  ): BuilderBlock;
}

export interface InlineTransportCodec {
  readonly typeId: string;
  encode(inline: BuilderInlineNode, registry: DocumentTransportRegistry): unknown;
  decode(
    id: string,
    payload: unknown,
    registry: DocumentTransportRegistry,
  ): BuilderInlineNode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireTransportRecord(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value;
}

export function requireTransportString(
  record: Record<string, unknown>,
  field: string,
  context: string,
): string {
  const value = record[field];
  if (typeof value !== "string") {
    throw new Error(`${context}.${field} must be a string`);
  }
  return value;
}

export function requireTransportNumber(
  record: Record<string, unknown>,
  field: string,
  context: string,
): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${context}.${field} must be a finite number`);
  }
  return value;
}

export function requireTransportBoolean(
  record: Record<string, unknown>,
  field: string,
  context: string,
): boolean {
  const value = record[field];
  if (typeof value !== "boolean") {
    throw new Error(`${context}.${field} must be a boolean`);
  }
  return value;
}

export function requireTransportArray(
  record: Record<string, unknown>,
  field: string,
  context: string,
): readonly unknown[] {
  const value = record[field];
  if (!Array.isArray(value)) {
    throw new Error(`${context}.${field} must be an array`);
  }
  return value;
}

function assertJsonValue(value: unknown, context: string): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${context} contains a non-finite number`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertJsonValue(item, `${context}[${String(index)}]`);
    });
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      assertJsonValue(item, `${context}.${key}`);
    }
    return;
  }
  throw new Error(`${context} is not JSON-compatible`);
}

function freezeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeJsonValue));
  }
  if (isRecord(value)) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, freezeJsonValue(item)]),
      ),
    );
  }
  return value;
}

function parseNodeEnvelope(value: unknown, context: string): CanonicalNodeEnvelope {
  const node = requireTransportRecord(value, context);
  const id = requireTransportString(node, "id", context);
  const type = requireTransportString(node, "type", context);
  if (id.length === 0 || type.length === 0) {
    throw new Error(`${context} requires non-empty id and type fields`);
  }
  if (!("payload" in node)) {
    throw new Error(`${context}.payload is required`);
  }
  assertJsonValue(node.payload, `${context}.payload`);
  return Object.freeze({ id, type, payload: freezeJsonValue(node.payload) });
}

export class DocumentTransportRegistry {
  readonly #blockCodecs = new Map<string, BlockTransportCodec>();
  readonly #inlineCodecs = new Map<string, InlineTransportCodec>();

  public constructor(
    blockCodecs: readonly BlockTransportCodec[],
    inlineCodecs: readonly InlineTransportCodec[],
  ) {
    for (const codec of blockCodecs) {
      if (codec.typeId.length === 0 || this.#blockCodecs.has(codec.typeId)) {
        throw new Error(`Invalid or duplicate block transport codec: ${codec.typeId}`);
      }
      this.#blockCodecs.set(codec.typeId, codec);
    }
    for (const codec of inlineCodecs) {
      if (codec.typeId.length === 0 || this.#inlineCodecs.has(codec.typeId)) {
        throw new Error(`Invalid or duplicate inline transport codec: ${codec.typeId}`);
      }
      this.#inlineCodecs.set(codec.typeId, codec);
    }
  }

  public encodeBlock(block: BuilderBlock): CanonicalNodeEnvelope {
    const codec = this.#blockCodecs.get(block.typeId);
    const payload =
      codec === undefined ? (block.opaquePayload ?? null) : codec.encode(block, this);
    assertJsonValue(payload, `Block ${block.id} payload`);
    return Object.freeze({ id: block.id, type: block.typeId, payload });
  }

  public decodeBlock(value: unknown, context = "Block"): BuilderBlock {
    const node = parseNodeEnvelope(value, context);
    const codec = this.#blockCodecs.get(node.type);
    if (codec === undefined) {
      return Object.freeze({
        id: node.id,
        typeId: node.type,
        opaquePayload: node.payload,
      });
    }
    const block = codec.decode(node.id, node.payload, this);
    if (block.id !== node.id || block.typeId !== node.type) {
      throw new Error(`Block codec ${node.type} changed its envelope identity`);
    }
    return Object.freeze(block);
  }

  public encodeInline(inline: BuilderInlineNode): CanonicalNodeEnvelope {
    const codec = this.#inlineCodecs.get(inline.typeId);
    const payload =
      codec === undefined ? (inline.opaquePayload ?? null) : codec.encode(inline, this);
    assertJsonValue(payload, `Inline ${inline.id} payload`);
    return Object.freeze({ id: inline.id, type: inline.typeId, payload });
  }

  public decodeInline(value: unknown, context = "Inline"): BuilderInlineNode {
    const node = parseNodeEnvelope(value, context);
    const codec = this.#inlineCodecs.get(node.type);
    if (codec === undefined) {
      return Object.freeze({
        id: node.id,
        typeId: node.type,
        label: `Unsupported ${node.type}`,
        opaquePayload: node.payload,
      });
    }
    const inline = codec.decode(node.id, node.payload, this);
    if (inline.id !== node.id || inline.typeId !== node.type) {
      throw new Error(`Inline codec ${node.type} changed its envelope identity`);
    }
    return Object.freeze(inline);
  }
}

export class CanonicalDocumentTransport {
  readonly #registry: DocumentTransportRegistry;

  public constructor(registry: DocumentTransportRegistry) {
    this.#registry = registry;
  }

  public toString(snapshot: DocumentSnapshot): string {
    const validated = new MemoryDocumentPort(
      snapshot.blocks,
      snapshot.metadata,
    ).getSnapshot();
    const envelope = {
      format: canonicalDocumentFormat,
      schemaVersion: canonicalDocumentSchemaVersion,
      documentVersion: { ...validated.metadata.modelVersion },
      blocks: validated.blocks.map((block) => this.#registry.encodeBlock(block)),
    };
    return `${JSON.stringify(envelope, null, 2)}\n`;
  }

  public fromString(source: string): DecodedDocumentTransport {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source) as unknown;
    } catch {
      throw new Error("Canonical document transport must be valid JSON");
    }

    const envelope = requireTransportRecord(parsed, "Document envelope");
    if (
      envelope.format !== canonicalDocumentFormat ||
      envelope.schemaVersion !== canonicalDocumentSchemaVersion
    ) {
      throw new Error("Unsupported canonical document format or schema version");
    }
    const version = requireTransportRecord(
      envelope.documentVersion,
      "Document envelope.documentVersion",
    );
    const metadata: DocumentMetadata = Object.freeze({
      modelVersion: Object.freeze({
        major: requireTransportNumber(version, "major", "Document version"),
        minor: requireTransportNumber(version, "minor", "Document version"),
        patch: requireTransportNumber(version, "patch", "Document version"),
      }),
    });
    const encodedBlocks = requireTransportArray(envelope, "blocks", "Document envelope");
    const blocks = Object.freeze(
      encodedBlocks.map((block, index) =>
        this.#registry.decodeBlock(block, `Document block ${String(index)}`),
      ),
    );

    // The memory port is the authoritative invariant checker for decoded data.
    const validationPort = new MemoryDocumentPort(blocks, metadata);
    const validated = validationPort.getSnapshot();
    return Object.freeze({ metadata: validated.metadata, blocks: validated.blocks });
  }
}
