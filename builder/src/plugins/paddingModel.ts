// Define the backend-neutral Padding block and its named child sequence.
import {
  childBlockSequences,
  createChildBlockSequence,
  type BuilderBlock,
  type BuilderChildBlockSequence,
} from "../model/document";

export const paddingTypeId = "dans.layout.padding";
export const paddingContentSequenceId = "content";

export interface PaddingInsets {
  readonly topEm: number;
  readonly rightEm: number;
  readonly bottomEm: number;
  readonly leftEm: number;
}

export interface PaddingBlock extends BuilderBlock {
  readonly typeId: typeof paddingTypeId;
  readonly insets: PaddingInsets;
  readonly childSequences: readonly BuilderChildBlockSequence[];
}

function validInset(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isPaddingInsets(value: unknown): value is PaddingInsets {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "topEm" in value &&
    typeof value.topEm === "number" &&
    "rightEm" in value &&
    typeof value.rightEm === "number" &&
    "bottomEm" in value &&
    typeof value.bottomEm === "number" &&
    "leftEm" in value &&
    typeof value.leftEm === "number"
  );
}

export function validatePaddingInsets(insets: PaddingInsets): void {
  if (
    !validInset(insets.topEm) ||
    !validInset(insets.rightEm) ||
    !validInset(insets.bottomEm) ||
    !validInset(insets.leftEm)
  ) {
    throw new Error("Padding insets must be finite non-negative em values");
  }
}

export function isPaddingBlock(block: BuilderBlock): block is PaddingBlock {
  if (
    block.typeId !== paddingTypeId ||
    !("insets" in block) ||
    !isPaddingInsets(block.insets)
  ) {
    return false;
  }
  const sequences = childBlockSequences(block);
  return (
    sequences.length === 1 &&
    sequences[0]?.id === paddingContentSequenceId
  );
}

export function requirePaddingBlock(block: BuilderBlock): PaddingBlock {
  if (!isPaddingBlock(block)) {
    throw new Error(`Padding plugin cannot consume ${block.typeId}`);
  }
  validatePaddingInsets(block.insets);
  return block;
}

export function paddingContent(block: PaddingBlock): readonly BuilderBlock[] {
  const sequence = block.childSequences[0];
  if (sequence?.id !== paddingContentSequenceId) {
    throw new Error("A Padding block must expose exactly one content sequence");
  }
  return sequence.blocks;
}

export function createPaddingBlock(
  id: string,
  insets: PaddingInsets,
  blocks: readonly BuilderBlock[] = [],
): PaddingBlock {
  if (id.length === 0) {
    throw new Error("A Padding block requires a stable ID");
  }
  validatePaddingInsets(insets);
  return Object.freeze({
    id,
    typeId: paddingTypeId,
    insets: Object.freeze({ ...insets }),
    childSequences: Object.freeze([
      createChildBlockSequence(paddingContentSequenceId, blocks),
    ]),
  });
}
