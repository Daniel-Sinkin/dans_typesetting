// Generic writer-owned numbering contracts shared by block and inline extensions.
export interface NumberedInlineOccurrence {
  readonly inlineId: string;
  readonly numberingSeries: string;
}

export interface NumberedBlockOccurrence {
  readonly occurrenceId: string;
  readonly numberingSeries: string;
}

export interface BlockOrdinal {
  readonly numberingSeries: string | null;
  readonly ordinal: number | null;
}

export interface InlineOrdinal {
  readonly numberingSeries: string;
  readonly ordinal: number;
}
