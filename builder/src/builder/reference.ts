// Writer-neutral result of resolving a stable semantic target in one document snapshot.
export interface BuilderReferenceTarget {
  readonly referenceId: string;
  readonly blockId: string;
  readonly occurrenceId: string;
  readonly typeId: string;
  readonly label: string;
  readonly number: string;
  readonly title: string | null;
  readonly displayText: string;
  readonly anchorId: string;
}

export interface BuilderReferenceTargetDescriptor {
  readonly referenceId: string | null;
  readonly label: string;
  readonly occurrenceId?: string | undefined;
  readonly title?: string | null | undefined;
  readonly numberSuffix?: string | undefined;
}

export function referenceAnchorId(referenceId: string): string {
  return `dans-reference-${encodeURIComponent(referenceId)}`;
}

export function blockAnchorId(blockId: string): string {
  return `dans-block-${encodeURIComponent(blockId)}`;
}
