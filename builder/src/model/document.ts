// builder/src/model/document.ts — define the builder transport snapshot and command boundary.
import { validateMathExpression, type MathExpression } from "./math";

export const paragraphTypeId = "dans.core-paragraph";
export const paragraphTextInlineTypeId = "dans.core-paragraph.text";
export const imageTypeId = "dans.image.figure";
export const mathDisplayTypeId = "dans.math.display";
export const codeListingTypeId = "dans.code.listing";

export type CodeListingLanguage = "cpp" | "julia";

export interface BuilderBlockEnvelope {
  readonly id: string;
  readonly typeId: string;
}

export interface BuilderBlock extends BuilderBlockEnvelope {
  readonly opaquePayload?: unknown;
}

export interface BuilderInlineEnvelope {
  readonly id: string;
  readonly typeId: string;
  readonly label?: string;
}

export interface BuilderInlineNode extends BuilderInlineEnvelope {
  readonly opaquePayload?: unknown;
}

export interface ParagraphTextInline extends BuilderInlineNode {
  readonly typeId: typeof paragraphTextInlineTypeId;
  readonly text: string;
}

export interface ParagraphBlock extends BuilderBlock {
  readonly typeId: typeof paragraphTypeId;
  readonly inlines: readonly BuilderInlineNode[];
}

export interface ImageBlock extends BuilderBlock {
  readonly typeId: typeof imageTypeId;
  readonly source: string;
  readonly caption: string;
  readonly widthFraction: number;
  readonly preferredPixelWidth: number;
  readonly preferredPixelHeight: number;
}

export interface MathDisplayBlock extends BuilderBlock {
  readonly typeId: typeof mathDisplayTypeId;
  readonly expression: MathExpression;
}

export interface CodeListingBlock extends BuilderBlock {
  readonly typeId: typeof codeListingTypeId;
  readonly language: CodeListingLanguage;
  readonly code: string;
  readonly caption: string;
}

export interface DocumentSnapshot {
  readonly revision: number;
  readonly blocks: readonly BuilderBlock[];
}

export type DocumentCommand =
  | Readonly<{
      kind: "insert";
      index: number;
      block: BuilderBlock;
    }>
  | Readonly<{
      kind: "move";
      blockId: string;
      index: number;
    }>
  | Readonly<{
      kind: "replace";
      blockId: string;
      block: BuilderBlock;
    }>
  | Readonly<{
      kind: "delete";
      blockId: string;
    }>;

export type DocumentListener = () => void;

export interface DocumentPort {
  getSnapshot(): DocumentSnapshot;
  dispatch(command: DocumentCommand): void;
  subscribe(listener: DocumentListener): () => void;
}

export function createBlockId(): string {
  return globalThis.crypto.randomUUID();
}

export function createParagraphText(
  text: string,
  id: string = createBlockId(),
): ParagraphTextInline {
  return Object.freeze({ id, typeId: paragraphTextInlineTypeId, text });
}

export function cloneBuilderBlock(block: BuilderBlock, id: string): BuilderBlock {
  if (id.length === 0) {
    throw new Error("A cloned builder block requires a stable ID");
  }
  return Object.freeze({ ...block, id });
}

export function isParagraphTextInline(
  inline: BuilderInlineNode,
): inline is ParagraphTextInline {
  return (
    inline.typeId === paragraphTextInlineTypeId &&
    "text" in inline &&
    typeof inline.text === "string"
  );
}

export function isParagraphBlock(block: BuilderBlock): block is ParagraphBlock {
  return (
    block.typeId === paragraphTypeId &&
    "inlines" in block &&
    Array.isArray(block.inlines)
  );
}

export function isImageBlock(block: BuilderBlock): block is ImageBlock {
  return (
    block.typeId === imageTypeId &&
    "source" in block &&
    typeof block.source === "string" &&
    "caption" in block &&
    typeof block.caption === "string" &&
    "widthFraction" in block &&
    typeof block.widthFraction === "number" &&
    "preferredPixelWidth" in block &&
    typeof block.preferredPixelWidth === "number" &&
    "preferredPixelHeight" in block &&
    typeof block.preferredPixelHeight === "number"
  );
}

export function isMathDisplayBlock(block: BuilderBlock): block is MathDisplayBlock {
  return block.typeId === mathDisplayTypeId && "expression" in block;
}

export function isCodeListingBlock(block: BuilderBlock): block is CodeListingBlock {
  return (
    block.typeId === codeListingTypeId &&
    "language" in block &&
    (block.language === "cpp" || block.language === "julia") &&
    "code" in block &&
    typeof block.code === "string" &&
    "caption" in block &&
    typeof block.caption === "string"
  );
}

export function paragraphDisplayText(paragraph: ParagraphBlock): string {
  return paragraph.inlines
    .map((inline) =>
      isParagraphTextInline(inline) ? inline.text : inline.label ?? `[${inline.typeId}]`,
    )
    .join("");
}

function validateInlineSequence(inlines: readonly BuilderInlineNode[]): void {
  if (inlines.length === 0) {
    throw new Error("A paragraph requires at least one inline node");
  }
  const inlineIds = new Set<string>();
  for (const inline of inlines) {
    if (inline.id.length === 0 || inline.typeId.length === 0) {
      throw new Error("Paragraph inline nodes require stable IDs and type IDs");
    }
    if (inlineIds.has(inline.id)) {
      throw new Error(`Duplicate paragraph inline ID: ${inline.id}`);
    }
    inlineIds.add(inline.id);
    if (inline.typeId === paragraphTextInlineTypeId && !isParagraphTextInline(inline)) {
      throw new Error("A paragraph text inline has an invalid transport shape");
    }
  }
}

function validateBlock(block: BuilderBlock): void {
  if (block.id.length === 0) {
    throw new Error("A builder block requires a stable ID");
  }
  if (block.typeId.length === 0) {
    throw new Error("A builder block requires a stable type ID");
  }

  switch (block.typeId) {
    case paragraphTypeId:
      if (!isParagraphBlock(block)) {
        throw new Error("A paragraph block has an invalid transport shape");
      }
      validateInlineSequence(block.inlines);
      return;
    case imageTypeId:
      if (!isImageBlock(block)) {
        throw new Error("An image block has an invalid transport shape");
      }
      if (block.source.trim().length === 0 || block.caption.trim().length === 0) {
        throw new Error("An image block requires a source and caption");
      }
      if (block.widthFraction <= 0 || block.widthFraction > 1) {
        throw new Error("Image widthFraction must be in the interval (0, 1]");
      }
      if (block.preferredPixelWidth <= 0 || block.preferredPixelHeight <= 0) {
        throw new Error("Preferred image pixel dimensions must be positive");
      }
      return;
    case mathDisplayTypeId:
      if (!isMathDisplayBlock(block)) {
        throw new Error("A display-math block has an invalid transport shape");
      }
      validateMathExpression(block.expression);
      return;
    case codeListingTypeId:
      if (!isCodeListingBlock(block)) {
        throw new Error("A code-listing block has an invalid transport shape");
      }
      if (block.code.length === 0 || block.caption.trim().length === 0) {
        throw new Error("A code listing requires source code and a caption");
      }
      return;
  }
}

export class MemoryDocumentPort implements DocumentPort {
  readonly #listeners = new Set<DocumentListener>();
  #snapshot: DocumentSnapshot;

  public constructor(initialBlocks: readonly BuilderBlock[]) {
    for (const block of initialBlocks) {
      validateBlock(block);
    }
    this.#assertUniqueIds(initialBlocks);
    this.#snapshot = Object.freeze({ revision: 0, blocks: Object.freeze([...initialBlocks]) });
  }

  public getSnapshot(): DocumentSnapshot {
    return this.#snapshot;
  }

  public dispatch(command: DocumentCommand): void {
    switch (command.kind) {
      case "insert":
        this.#insert(command.index, command.block);
        return;
      case "move":
        this.#move(command.blockId, command.index);
        return;
      case "replace":
        this.#replace(command.blockId, command.block);
        return;
      case "delete":
        this.#delete(command.blockId);
        return;
    }
  }

  public subscribe(listener: DocumentListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #assertUniqueIds(blocks: readonly BuilderBlock[]): void {
    const ids = new Set<string>();
    for (const block of blocks) {
      if (ids.has(block.id)) {
        throw new Error(`Duplicate document block ID: ${block.id}`);
      }
      ids.add(block.id);
    }
  }

  #insert(index: number, block: BuilderBlock): void {
    if (index < 0 || index > this.#snapshot.blocks.length) {
      throw new RangeError(`Insert index ${String(index)} is outside the document`);
    }

    validateBlock(block);
    if (this.#snapshot.blocks.some((candidate) => candidate.id === block.id)) {
      throw new Error(`Duplicate document block ID: ${block.id}`);
    }

    const blocks = [...this.#snapshot.blocks];
    blocks.splice(index, 0, Object.freeze(block));
    this.#publish(blocks);
  }

  #move(blockId: string, index: number): void {
    const currentIndex = this.#snapshot.blocks.findIndex((block) => block.id === blockId);
    if (currentIndex < 0) {
      throw new Error(`Unknown document block ID: ${blockId}`);
    }

    const blocks = this.#snapshot.blocks.filter((block) => block.id !== blockId);
    if (index < 0 || index > blocks.length) {
      throw new RangeError(`Move index ${String(index)} is outside the document`);
    }

    const block = this.#snapshot.blocks[currentIndex];
    if (block === undefined) {
      throw new Error(`Unknown document block ID: ${blockId}`);
    }
    blocks.splice(index, 0, block);
    if (blocks.every((candidate, candidateIndex) => candidate === this.#snapshot.blocks[candidateIndex])) {
      return;
    }
    this.#publish(blocks);
  }

  #replace(blockId: string, block: BuilderBlock): void {
    const currentIndex = this.#snapshot.blocks.findIndex((candidate) => candidate.id === blockId);
    if (currentIndex < 0) {
      throw new Error(`Unknown document block ID: ${blockId}`);
    }
    const currentBlock = this.#snapshot.blocks[currentIndex];
    if (currentBlock === undefined) {
      throw new Error(`Unknown document block ID: ${blockId}`);
    }
    if (block.id !== blockId || block.typeId !== currentBlock.typeId) {
      throw new Error("A replacement must preserve its block ID and semantic type");
    }
    validateBlock(block);
    if (block === currentBlock) {
      return;
    }

    const blocks = [...this.#snapshot.blocks];
    blocks[currentIndex] = Object.freeze(block);
    this.#publish(blocks);
  }

  #delete(blockId: string): void {
    const blocks = this.#snapshot.blocks.filter((block) => block.id !== blockId);
    if (blocks.length === this.#snapshot.blocks.length) {
      throw new Error(`Unknown document block ID: ${blockId}`);
    }
    this.#publish(blocks);
  }

  #publish(blocks: readonly BuilderBlock[]): void {
    this.#snapshot = Object.freeze({
      revision: this.#snapshot.revision + 1,
      blocks: Object.freeze([...blocks]),
    });

    for (const listener of this.#listeners) {
      listener();
    }
  }
}
