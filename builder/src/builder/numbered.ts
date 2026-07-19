// Generic writer-owned numbering contracts shared by block and inline extensions.
export interface NumberedInlineOccurrence {
  readonly inlineId: string;
  readonly numberingSeries: string;
}

export interface InlineOrdinal {
  readonly numberingSeries: string;
  readonly ordinal: number;
}
