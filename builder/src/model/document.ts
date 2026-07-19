// builder/src/model/document.ts — define the builder transport snapshot and command boundary.
import { validateMathExpression, type MathExpression } from "./math";
import { requireReferenceId, validateOptionalReferenceId } from "./referenceId";

export const paragraphTypeId = "dans.core.paragraph";
export const textInlineTypeId = "dans.core.text";
export const mathDisplayTypeId = "dans.math.display";
export const mathInlineTypeId = "dans.math.inline";
export const hyperlinkInlineTypeId = "dans.inline.hyperlink";
export const referenceInlineTypeId = "dans.inline.reference";
export const sectionTypeId = "dans.core.section";
export const titlePageTypeId = "dans.document.title_page";
export const tableOfContentsTypeId = "dans.document.table_of_contents";
export const pageBreakTypeId = "dans.document.page_break";

export type TextStyle = "normal" | "bold" | "italic" | "bold_italic";

export interface DocumentModelVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

export interface DocumentMetadata {
  readonly modelVersion: DocumentModelVersion;
}

export const defaultDocumentMetadata: DocumentMetadata = Object.freeze({
  modelVersion: Object.freeze({ major: 0, minor: 1, patch: 0 }),
});

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

// The shared semantic consumption point used by paragraphs, captions, list
// items, table cells, links, footnotes, and future inline hosts.
export type InlineSequence = readonly BuilderInlineNode[];

export interface TextInline extends BuilderInlineNode {
  readonly typeId: typeof textInlineTypeId;
  readonly text: string;
  readonly style: TextStyle;
}

export interface MathInline extends BuilderInlineNode {
  readonly typeId: typeof mathInlineTypeId;
  readonly expression: MathExpression;
}

export interface HyperlinkInline extends BuilderInlineNode {
  readonly typeId: typeof hyperlinkInlineTypeId;
  readonly target: string;
  readonly labelInlines: InlineSequence;
}

export interface ReferenceInline extends BuilderInlineNode {
  readonly typeId: typeof referenceInlineTypeId;
  readonly targetReferenceId: string;
}

export interface ParagraphBlock extends BuilderBlock {
  readonly typeId: typeof paragraphTypeId;
  readonly inlines: InlineSequence;
}

export type MathDisplayAlignment = "automatic" | "disabled";

export interface MathDisplayLine {
  readonly id: string;
  readonly expression: MathExpression;
  readonly numbered: boolean;
  readonly referenceId: string | null;
}

export interface MathDisplayBlock extends BuilderBlock {
  readonly typeId: typeof mathDisplayTypeId;
  readonly lines: readonly MathDisplayLine[];
  readonly alignment: MathDisplayAlignment;
}

export interface SectionBlock extends BuilderBlock {
  readonly typeId: typeof sectionTypeId;
  readonly title: string;
  readonly referenceId: string | null;
  readonly blocks: readonly BuilderBlock[];
}

export interface TitlePageBlock extends BuilderBlock {
  readonly typeId: typeof titlePageTypeId;
  readonly title: string;
  readonly author: string;
  readonly date: string;
}

export interface TableOfContentsBlock extends BuilderBlock {
  readonly typeId: typeof tableOfContentsTypeId;
}

export interface PageBreakBlock extends BuilderBlock {
  readonly typeId: typeof pageBreakTypeId;
}

export interface DocumentSnapshot {
  readonly revision: number;
  readonly metadata: DocumentMetadata;
  readonly blocks: readonly BuilderBlock[];
}

export type DocumentCommand =
  | Readonly<{
      kind: "insert";
      index: number;
      block: BuilderBlock;
      parentId?: string | null;
    }>
  | Readonly<{
      kind: "move";
      blockId: string;
      index: number;
      parentId?: string | null;
    }>
  | Readonly<{
      kind: "replace";
      blockId: string;
      block: BuilderBlock;
    }>
  | Readonly<{
      kind: "delete";
      blockId: string;
    }>
  | Readonly<{
      kind: "replace_all";
      metadata: DocumentMetadata;
      blocks: readonly BuilderBlock[];
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

export function createText(
  text: string,
  id: string = createBlockId(),
  style: TextStyle = "normal",
): TextInline {
  return Object.freeze({ id, typeId: textInlineTypeId, text, style });
}

export function createMathInline(
  expression: MathExpression,
  id: string = createBlockId(),
): MathInline {
  validateMathExpression(expression);
  return Object.freeze({ id, typeId: mathInlineTypeId, expression });
}

export function createMathDisplayLine(
  expression: MathExpression,
  numbered = true,
  referenceId: string | null = null,
  id: string = createBlockId(),
): MathDisplayLine {
  validateMathExpression(expression);
  if (id.length === 0) {
    throw new Error("A display-math line requires a stable ID");
  }
  if (!numbered && referenceId !== null) {
    throw new Error("An unnumbered display-math line cannot expose a reference ID");
  }
  if (referenceId !== null) {
    validateOptionalReferenceId(referenceId, "Equation reference ID");
  }
  return Object.freeze({ id, expression, numbered, referenceId });
}

export function createHyperlinkInline(
  target: string,
  labelInlines: readonly BuilderInlineNode[] = [],
  id: string = createBlockId(),
): HyperlinkInline {
  return Object.freeze({
    id,
    typeId: hyperlinkInlineTypeId,
    target,
    labelInlines: Object.freeze([...labelInlines]),
  });
}

export function createReferenceInline(
  targetReferenceId: string,
  id: string = createBlockId(),
): ReferenceInline {
  return Object.freeze({
    id,
    typeId: referenceInlineTypeId,
    targetReferenceId: requireReferenceId(targetReferenceId, "Reference target ID"),
  });
}

export function isTextInline(
  inline: BuilderInlineNode,
): inline is TextInline {
  return (
    inline.typeId === textInlineTypeId &&
    "text" in inline &&
    typeof inline.text === "string" &&
    "style" in inline &&
    isTextStyle(inline.style)
  );
}

export function isMathInline(inline: BuilderInlineNode): inline is MathInline {
  return inline.typeId === mathInlineTypeId && "expression" in inline;
}

export function isHyperlinkInline(inline: BuilderInlineNode): inline is HyperlinkInline {
  return (
    inline.typeId === hyperlinkInlineTypeId &&
    "target" in inline &&
    typeof inline.target === "string" &&
    "labelInlines" in inline &&
    Array.isArray(inline.labelInlines)
  );
}

export function isReferenceInline(inline: BuilderInlineNode): inline is ReferenceInline {
  return (
    inline.typeId === referenceInlineTypeId &&
    "targetReferenceId" in inline &&
    typeof inline.targetReferenceId === "string"
  );
}

export function isParagraphBlock(block: BuilderBlock): block is ParagraphBlock {
  return (
    block.typeId === paragraphTypeId &&
    "inlines" in block &&
    Array.isArray(block.inlines)
  );
}

function isMathDisplayLineShape(value: unknown): value is MathDisplayLine {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "id" in value &&
    typeof value.id === "string" &&
    "expression" in value &&
    "numbered" in value &&
    typeof value.numbered === "boolean" &&
    "referenceId" in value &&
    (value.referenceId === null || typeof value.referenceId === "string")
  );
}

export function isMathDisplayBlock(block: BuilderBlock): block is MathDisplayBlock {
  return (
    block.typeId === mathDisplayTypeId &&
    "lines" in block &&
    Array.isArray(block.lines) &&
    block.lines.every(isMathDisplayLineShape) &&
    "alignment" in block &&
    (block.alignment === "automatic" || block.alignment === "disabled")
  );
}

export function isSectionBlock(block: BuilderBlock): block is SectionBlock {
  return (
    block.typeId === sectionTypeId &&
    "title" in block &&
    typeof block.title === "string" &&
    "referenceId" in block &&
    (block.referenceId === null || typeof block.referenceId === "string") &&
    "blocks" in block &&
    Array.isArray(block.blocks)
  );
}

export function isTitlePageBlock(block: BuilderBlock): block is TitlePageBlock {
  return (
    block.typeId === titlePageTypeId &&
    "title" in block &&
    typeof block.title === "string" &&
    "author" in block &&
    typeof block.author === "string" &&
    "date" in block &&
    typeof block.date === "string"
  );
}

export function isTableOfContentsBlock(
  block: BuilderBlock,
): block is TableOfContentsBlock {
  return block.typeId === tableOfContentsTypeId;
}

export function isPageBreakBlock(block: BuilderBlock): block is PageBreakBlock {
  return block.typeId === pageBreakTypeId;
}

export interface BuilderBlockLocation {
  readonly block: BuilderBlock;
  readonly parentId: string | null;
  readonly index: number;
}

export function flattenBuilderBlocks(
  blocks: readonly BuilderBlock[],
): readonly BuilderBlock[] {
  const result: BuilderBlock[] = [];
  const visit = (sequence: readonly BuilderBlock[]): void => {
    for (const block of sequence) {
      result.push(block);
      if (isSectionBlock(block)) {
        visit(block.blocks);
      }
    }
  };
  visit(blocks);
  return result;
}

export function findBuilderBlock(
  blocks: readonly BuilderBlock[],
  blockId: string,
  parentId: string | null = null,
): BuilderBlockLocation | null {
  for (const [index, block] of blocks.entries()) {
    if (block.id === blockId) {
      return { block, parentId, index };
    }
    if (isSectionBlock(block)) {
      const nested = findBuilderBlock(block.blocks, blockId, block.id);
      if (nested !== null) {
        return nested;
      }
    }
  }
  return null;
}

export function paragraphDisplayText(paragraph: ParagraphBlock): string {
  return paragraph.inlines
    .map((inline) =>
      isTextInline(inline) ? inline.text : inline.label ?? `[${inline.typeId}]`,
    )
    .join("");
}

function isTextStyle(value: unknown): value is TextStyle {
  return (
    value === "normal" ||
    value === "bold" ||
    value === "italic" ||
    value === "bold_italic"
  );
}

function validateHyperlinkTarget(target: string): void {
  let invalid = target.length === 0;
  for (const character of target) {
    const codePoint = character.codePointAt(0) ?? 0;
    invalid ||=
      codePoint < 0x21 ||
      codePoint === 0x7f ||
      character === "{" ||
      character === "}" ||
      character === "\\";
  }
  if (invalid) {
    throw new Error(
      "A hyperlink target must not be empty or contain whitespace, braces, backslashes, or control characters",
    );
  }
}

function validateInlineSequence(
  inlines: readonly BuilderInlineNode[],
  requireContent = true,
  allowHyperlinks = true,
): void {
  if (requireContent && inlines.length === 0) {
    throw new Error("An inline sequence requires at least one node");
  }
  const inlineIds = new Set<string>();
  for (const inline of inlines) {
    if (inline.id.length === 0 || inline.typeId.length === 0) {
      throw new Error("Inline nodes require stable IDs and type IDs");
    }
    if (inlineIds.has(inline.id)) {
      throw new Error(`Duplicate inline ID: ${inline.id}`);
    }
    inlineIds.add(inline.id);
    if (inline.typeId === textInlineTypeId && !isTextInline(inline)) {
      throw new Error("A text inline has an invalid transport shape");
    }
    if (inline.typeId === mathInlineTypeId) {
      if (!isMathInline(inline)) {
        throw new Error("An inline-math node has an invalid transport shape");
      }
      validateMathExpression(inline.expression);
    }
    if (inline.typeId === hyperlinkInlineTypeId) {
      if (!allowHyperlinks) {
        throw new Error("A hyperlink label cannot contain another hyperlink");
      }
      if (!isHyperlinkInline(inline)) {
        throw new Error("A hyperlink inline has an invalid transport shape");
      }
      validateHyperlinkTarget(inline.target);
      validateInlineSequence(inline.labelInlines, false, false);
    }
    if (inline.typeId === referenceInlineTypeId) {
      if (!isReferenceInline(inline)) {
        throw new Error("A reference inline has an invalid transport shape");
      }
      requireReferenceId(inline.targetReferenceId, "Reference target ID");
    }
  }
}

function validateBlock(block: BuilderBlock, sectionDepth = 0): void {
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
    case mathDisplayTypeId:
      if (!isMathDisplayBlock(block)) {
        throw new Error("A display-math block has an invalid transport shape");
      }
      if (block.lines.length === 0) {
        throw new Error("A display-math block requires at least one line");
      }
      {
        const lineIds = new Set<string>();
        for (const line of block.lines) {
          if (line.id.length === 0) {
            throw new Error("A display-math line requires a stable ID");
          }
          if (lineIds.has(line.id)) {
            throw new Error(`Duplicate display-math line ID: ${line.id}`);
          }
          lineIds.add(line.id);
          validateMathExpression(line.expression);
          if (!line.numbered && line.referenceId !== null) {
            throw new Error(
              "An unnumbered display-math line cannot expose a reference ID",
            );
          }
          if (line.referenceId !== null) {
            validateOptionalReferenceId(line.referenceId, "Equation reference ID");
          }
        }
      }
      return;
    case sectionTypeId:
      if (!isSectionBlock(block)) {
        throw new Error("A section block has an invalid transport shape");
      }
      if (sectionDepth >= 5) {
        throw new Error("The document supports at most five nested section levels");
      }
      if (block.title.trim().length === 0) {
        throw new Error("A section requires a title");
      }
      if (block.referenceId !== null) {
        validateOptionalReferenceId(block.referenceId, "Section reference ID");
      }
      for (const child of block.blocks) {
        validateBlock(child, sectionDepth + 1);
      }
      return;
    case titlePageTypeId:
      if (!isTitlePageBlock(block)) {
        throw new Error("A title-page block has an invalid transport shape");
      }
      if (
        block.title.trim().length === 0 ||
        block.author.trim().length === 0 ||
        block.date.trim().length === 0
      ) {
        throw new Error("A title page requires a title, author, and date");
      }
      return;
    case tableOfContentsTypeId:
      if (!isTableOfContentsBlock(block)) {
        throw new Error("A table-of-contents block has an invalid transport shape");
      }
      return;
    case pageBreakTypeId:
      if (!isPageBreakBlock(block)) {
        throw new Error("A page-break block has an invalid transport shape");
      }
      return;
  }
}

function validateDocumentBlocks(blocks: readonly BuilderBlock[]): void {
  for (const block of blocks) {
    validateBlock(block);
  }
  const ids = new Set<string>();
  for (const block of flattenBuilderBlocks(blocks)) {
    if (ids.has(block.id)) {
      throw new Error(`Duplicate document block ID: ${block.id}`);
    }
    ids.add(block.id);
  }
  const displayLineIds = new Set<string>();
  for (const block of flattenBuilderBlocks(blocks)) {
    if (!isMathDisplayBlock(block)) {
      continue;
    }
    for (const line of block.lines) {
      if (ids.has(line.id) || displayLineIds.has(line.id)) {
        throw new Error(`Duplicate document occurrence ID: ${line.id}`);
      }
      displayLineIds.add(line.id);
    }
  }
}

function freezeBuilderBlock(block: BuilderBlock): BuilderBlock {
  if (isSectionBlock(block)) {
    return Object.freeze({
      ...block,
      blocks: Object.freeze(block.blocks.map(freezeBuilderBlock)),
    });
  }
  if (isMathDisplayBlock(block)) {
    return Object.freeze({
      ...block,
      lines: Object.freeze(
        block.lines.map((line) =>
          Object.freeze({
            ...line,
          }),
        ),
      ),
    });
  }
  return Object.freeze(block);
}

function freezeBuilderBlocks(blocks: readonly BuilderBlock[]): readonly BuilderBlock[] {
  return Object.freeze(blocks.map(freezeBuilderBlock));
}

function validateMetadata(metadata: DocumentMetadata): void {
  const { major, minor, patch } = metadata.modelVersion;
  for (const [name, value, maximum] of [
    ["major", major, 65_535],
    ["minor", minor, 65_535],
    ["patch", patch, 4_294_967_295],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
      throw new Error(
        `Document model version ${name} must be an integer in [0, ${String(maximum)}]`,
      );
    }
  }
}

interface DetachedBlock {
  readonly blocks: readonly BuilderBlock[];
  readonly block: BuilderBlock;
  readonly parentId: string | null;
  readonly index: number;
}

function detachBuilderBlock(
  blocks: readonly BuilderBlock[],
  blockId: string,
  parentId: string | null = null,
): DetachedBlock | null {
  for (const [index, block] of blocks.entries()) {
    if (block.id === blockId) {
      const remaining = [...blocks];
      remaining.splice(index, 1);
      return { blocks: remaining, block, parentId, index };
    }
    if (isSectionBlock(block)) {
      const nested = detachBuilderBlock(block.blocks, blockId, block.id);
      if (nested !== null) {
        const updated = [...blocks];
        updated[index] = Object.freeze({
          ...block,
          blocks: Object.freeze([...nested.blocks]),
        });
        return { ...nested, blocks: updated };
      }
    }
  }
  return null;
}

export function removeBuilderBlockFromTree(
  blocks: readonly BuilderBlock[],
  blockId: string,
): readonly BuilderBlock[] {
  return detachBuilderBlock(blocks, blockId)?.blocks ?? blocks;
}

function updateSectionChildren(
  blocks: readonly BuilderBlock[],
  parentId: string,
  update: (children: readonly BuilderBlock[]) => readonly BuilderBlock[],
): readonly BuilderBlock[] | null {
  for (const [index, block] of blocks.entries()) {
    if (!isSectionBlock(block)) {
      continue;
    }
    if (block.id === parentId) {
      const updated = [...blocks];
      updated[index] = Object.freeze({
        ...block,
        blocks: Object.freeze([...update(block.blocks)]),
      });
      return updated;
    }
    const nested = updateSectionChildren(block.blocks, parentId, update);
    if (nested !== null) {
      const updated = [...blocks];
      updated[index] = Object.freeze({
        ...block,
        blocks: Object.freeze([...nested]),
      });
      return updated;
    }
  }
  return null;
}

function insertBuilderBlock(
  blocks: readonly BuilderBlock[],
  parentId: string | null,
  index: number,
  block: BuilderBlock,
): readonly BuilderBlock[] {
  const insert = (sequence: readonly BuilderBlock[]): readonly BuilderBlock[] => {
    if (index < 0 || index > sequence.length) {
      throw new RangeError(`Insert index ${String(index)} is outside the target sequence`);
    }
    const updated = [...sequence];
    updated.splice(index, 0, block);
    return updated;
  };
  if (parentId === null) {
    return insert(blocks);
  }
  const updated = updateSectionChildren(blocks, parentId, insert);
  if (updated === null) {
    throw new Error(`Unknown section parent ID: ${parentId}`);
  }
  return updated;
}

function replaceBuilderBlock(
  blocks: readonly BuilderBlock[],
  blockId: string,
  replacement: BuilderBlock,
): readonly BuilderBlock[] | null {
  for (const [index, block] of blocks.entries()) {
    if (block.id === blockId) {
      const updated = [...blocks];
      updated[index] = replacement;
      return updated;
    }
    if (isSectionBlock(block)) {
      const nested = replaceBuilderBlock(block.blocks, blockId, replacement);
      if (nested !== null) {
        const updated = [...blocks];
        updated[index] = Object.freeze({
          ...block,
          blocks: Object.freeze([...nested]),
        });
        return updated;
      }
    }
  }
  return null;
}

export function replaceBuilderBlockInTree(
  blocks: readonly BuilderBlock[],
  blockId: string,
  replacement: BuilderBlock,
): readonly BuilderBlock[] {
  const updated = replaceBuilderBlock(blocks, blockId, replacement);
  if (updated === null) {
    throw new Error(`Unknown document block ID: ${blockId}`);
  }
  return updated;
}

export class MemoryDocumentPort implements DocumentPort {
  readonly #listeners = new Set<DocumentListener>();
  #snapshot: DocumentSnapshot;

  public constructor(
    initialBlocks: readonly BuilderBlock[],
    metadata: DocumentMetadata = defaultDocumentMetadata,
  ) {
    validateMetadata(metadata);
    validateDocumentBlocks(initialBlocks);
    this.#snapshot = Object.freeze({
      revision: 0,
      metadata: Object.freeze({
        modelVersion: Object.freeze({ ...metadata.modelVersion }),
      }),
      blocks: freezeBuilderBlocks(initialBlocks),
    });
  }

  public getSnapshot(): DocumentSnapshot {
    return this.#snapshot;
  }

  public dispatch(command: DocumentCommand): void {
    switch (command.kind) {
      case "insert":
        this.#insert(command.parentId ?? null, command.index, command.block);
        return;
      case "move":
        this.#move(command.blockId, command.parentId ?? null, command.index);
        return;
      case "replace":
        this.#replace(command.blockId, command.block);
        return;
      case "delete":
        this.#delete(command.blockId);
        return;
      case "replace_all":
        this.#replaceAll(command.metadata, command.blocks);
        return;
    }
  }

  public subscribe(listener: DocumentListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #insert(parentId: string | null, index: number, block: BuilderBlock): void {
    validateBlock(block);
    const candidateIds = new Set(
      flattenBuilderBlocks(this.#snapshot.blocks).map((candidate) => candidate.id),
    );
    if (flattenBuilderBlocks([block]).some((candidate) => candidateIds.has(candidate.id))) {
      throw new Error(`Duplicate document block ID: ${block.id}`);
    }
    const blocks = insertBuilderBlock(this.#snapshot.blocks, parentId, index, block);
    validateDocumentBlocks(blocks);
    this.#publish(blocks);
  }

  #move(blockId: string, parentId: string | null, index: number): void {
    const detached = detachBuilderBlock(this.#snapshot.blocks, blockId);
    if (detached === null) {
      throw new Error(`Unknown document block ID: ${blockId}`);
    }
    if (detached.parentId === parentId && detached.index === index) {
      return;
    }
    if (
      isSectionBlock(detached.block) &&
      (detached.block.id === parentId ||
        flattenBuilderBlocks(detached.block.blocks).some((block) => block.id === parentId))
    ) {
      throw new Error("A section cannot be moved inside itself or one of its descendants");
    }
    const blocks = insertBuilderBlock(detached.blocks, parentId, index, detached.block);
    validateDocumentBlocks(blocks);
    this.#publish(blocks);
  }

  #replace(blockId: string, block: BuilderBlock): void {
    const location = findBuilderBlock(this.#snapshot.blocks, blockId);
    if (location === null) {
      throw new Error(`Unknown document block ID: ${blockId}`);
    }
    if (block.id !== blockId || block.typeId !== location.block.typeId) {
      throw new Error("A replacement must preserve its block ID and semantic type");
    }
    validateBlock(block);
    if (block === location.block) {
      return;
    }
    const blocks = replaceBuilderBlock(this.#snapshot.blocks, blockId, block);
    if (blocks === null) {
      throw new Error(`Unknown document block ID: ${blockId}`);
    }
    validateDocumentBlocks(blocks);
    this.#publish(blocks);
  }

  #delete(blockId: string): void {
    const detached = detachBuilderBlock(this.#snapshot.blocks, blockId);
    if (detached === null) {
      throw new Error(`Unknown document block ID: ${blockId}`);
    }
    this.#publish(detached.blocks);
  }

  #replaceAll(metadata: DocumentMetadata, blocks: readonly BuilderBlock[]): void {
    validateMetadata(metadata);
    validateDocumentBlocks(blocks);
    this.#publish(blocks, metadata);
  }

  #publish(
    blocks: readonly BuilderBlock[],
    metadata: DocumentMetadata = this.#snapshot.metadata,
  ): void {
    this.#snapshot = Object.freeze({
      revision: this.#snapshot.revision + 1,
      metadata: Object.freeze({
        modelVersion: Object.freeze({ ...metadata.modelVersion }),
      }),
      blocks: freezeBuilderBlocks(blocks),
    });

    for (const listener of this.#listeners) {
      listener();
    }
  }
}
