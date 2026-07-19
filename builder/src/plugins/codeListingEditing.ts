// Pure source-editor transforms used by the graphical code-listing connector.
export interface TextInsertion {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

export function insertSpacesAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  count = 4,
): TextInsertion {
  if (
    !Number.isInteger(selectionStart) ||
    !Number.isInteger(selectionEnd) ||
    selectionStart < 0 ||
    selectionEnd < selectionStart ||
    selectionEnd > value.length
  ) {
    throw new Error("A text insertion requires an ordered selection within the source text");
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("A text insertion requires at least one space");
  }

  const spaces = " ".repeat(count);
  const nextPosition = selectionStart + spaces.length;
  return Object.freeze({
    value: `${value.slice(0, selectionStart)}${spaces}${value.slice(selectionEnd)}`,
    selectionStart: nextPosition,
    selectionEnd: nextPosition,
  });
}
