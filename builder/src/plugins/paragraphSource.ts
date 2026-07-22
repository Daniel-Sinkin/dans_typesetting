// A compact, keyboard-first source representation for semantic paragraph inlines.
import {
  createBlockId,
  createHyperlinkInline,
  createReferenceInline,
  createText,
  isHyperlinkInline,
  isReferenceInline,
  isTextInline,
  type BuilderInlineNode,
  type TextStyle,
} from "../model/document";
import {
  createCitationInline,
  isCitationInline,
  requireCitationInline,
} from "./bibliographyModel";
import {
  colorSpanInlineTypeId,
  colorToHex,
  createColorSpanInline,
  requireColorSpan,
} from "./colorSpanModel";
import {
  createFootnoteInline,
  footnoteInlineTypeId,
  requireFootnote,
} from "./footnoteModel";
import {
  createInlineCode,
  inlineCodeTypeId,
  requireInlineCode,
} from "./inlineCodeModel";
import {
  createInlineImage,
  inlineImageTypeId,
  requireInlineImage,
} from "./inlineImageModel";
import {
  createLatexMathInline,
  latexMathInlineTypeId,
  requireLatexMathInline,
} from "./latexMathModel";

interface ParseResult {
  readonly inlines: readonly BuilderInlineNode[];
  readonly converted: boolean;
}

function styledTextSource(text: string, style: TextStyle): string {
  const escaped = text.replace(/([\\§$%*`[\]])/gu, "\\$1");
  switch (style) {
    case "bold":
      return `**${escaped}**`;
    case "italic":
      return `*${escaped}*`;
    case "bold_italic":
      return `***${escaped}***`;
    case "normal":
      return escaped;
  }
}

function escapedField(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("§", "\\§");
}

/** Serializes the editable subset without involving a document export format. */
export function paragraphInlinesToSource(
  inlines: readonly BuilderInlineNode[],
): string {
  return inlines
    .map((inline) => {
      if (isTextInline(inline)) {
        return styledTextSource(inline.text, inline.style);
      }
      if (inline.typeId === latexMathInlineTypeId) {
        return `$${requireLatexMathInline(inline).source}$`;
      }
      if (isHyperlinkInline(inline)) {
        const label = paragraphInlinesToSource(inline.labelInlines);
        return `[${label.length === 0 ? inline.target : label}](${inline.target})`;
      }
      if (isReferenceInline(inline)) {
        return `§reference§${escapedField(inline.targetReferenceId)}§`;
      }
      if (inline.typeId === footnoteInlineTypeId) {
        return `§footnote§${escapedField(paragraphInlinesToSource(requireFootnote(inline).inlines))}§`;
      }
      if (inline.typeId === inlineCodeTypeId) {
        return `\`${requireInlineCode(inline).code}\``;
      }
      if (isCitationInline(inline)) {
        return `§citation§${requireCitationInline(inline).keys.join(",")}§`;
      }
      if (inline.typeId === colorSpanInlineTypeId) {
        const colour = requireColorSpan(inline);
        return `§color§${colorToHex(colour.color)}§${escapedField(paragraphInlinesToSource(colour.inlines))}§`;
      }
      if (inline.typeId === inlineImageTypeId) {
        const image = requireInlineImage(inline);
        return `§image§${escapedField(image.source)}§${String(image.heightEm)}§`;
      }
      return `§inline§${escapedField(inline.typeId)}§`;
    })
    .join("");
}

function findUnescaped(source: string, needle: string, from: number): number {
  let cursor = from;
  while (cursor < source.length) {
    const match = source.indexOf(needle, cursor);
    if (match < 0) {
      return -1;
    }
    let slashes = 0;
    for (let index = match - 1; index >= 0 && source[index] === "\\"; index -= 1) {
      slashes += 1;
    }
    if (slashes % 2 === 0) {
      return match;
    }
    cursor = match + needle.length;
  }
  return -1;
}

function unescapeSource(value: string): string {
  return value.replace(/\\([\\§$%*`[\]])/gu, "$1");
}

function decodeField(value: string): string {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index);
    const next = value.charAt(index + 1);
    if (
      character === "\\" &&
      (next === "\\" || next === "§")
    ) {
      decoded += next;
      index += 1;
    } else {
      decoded += character;
    }
  }
  return decoded;
}

function appendText(
  target: BuilderInlineNode[],
  text: string,
  style: TextStyle,
): void {
  if (text.length === 0) {
    return;
  }
  const previous = target.at(-1);
  if (previous !== undefined && isTextInline(previous) && previous.style === style) {
    target[target.length - 1] = createText(previous.text + text, previous.id, style);
    return;
  }
  target.push(createText(text, createBlockId(), style));
}

function commandAt(
  source: string,
  start: number,
): Readonly<{ inline: BuilderInlineNode; end: number }> | null {
  const commandEnd = findUnescaped(source, "§", start + 1);
  if (commandEnd < 0) {
    return null;
  }
  const command = source.slice(start + 1, commandEnd).toLowerCase();
  const firstEnd = findUnescaped(source, "§", commandEnd + 1);
  if (firstEnd < 0) {
    return null;
  }
  const rawFirst = source.slice(commandEnd + 1, firstEnd);
  const first = decodeField(rawFirst);
  try {
    if (command === "reference" || command === "ref") {
      return { inline: createReferenceInline(first), end: firstEnd + 1 };
    }
    if (command === "citation" || command === "cite") {
      const keys = first.split(",").map((key) => key.trim()).filter(Boolean);
      return { inline: createCitationInline(keys), end: firstEnd + 1 };
    }
    if (command === "footnote" || command === "note") {
      const nested = parseParagraphSource(first).inlines;
      return {
        inline: createFootnoteInline(
          nested.length === 0 ? [createText(first)] : nested,
        ),
        end: firstEnd + 1,
      };
    }
    if (command === "image") {
      const heightEnd = findUnescaped(source, "§", firstEnd + 1);
      if (heightEnd < 0) {
        return null;
      }
      const height = Number(decodeField(source.slice(firstEnd + 1, heightEnd)));
      return { inline: createInlineImage(first, height), end: heightEnd + 1 };
    }
    if (command === "color" || command === "colour") {
      const contentEnd = findUnescaped(source, "§", firstEnd + 1);
      if (contentEnd < 0 || !/^#[0-9a-f]{6}$/iu.test(first)) {
        return null;
      }
      const rawContent = source.slice(firstEnd + 1, contentEnd);
      const content = decodeField(rawContent);
      const nested = parseParagraphSource(content).inlines;
      const red = Number.parseInt(first.slice(1, 3), 16);
      const green = Number.parseInt(first.slice(3, 5), 16);
      const blue = Number.parseInt(first.slice(5, 7), 16);
      return {
        inline: createColorSpanInline(
          { red, green, blue },
          nested.length === 0 ? [createText(content)] : nested,
        ),
        end: contentEnd + 1,
      };
    }
    if (command === "hyperlink" || command === "link") {
      const targetEnd = findUnescaped(source, "§", firstEnd + 1);
      if (targetEnd < 0) {
        return null;
      }
      const target = decodeField(source.slice(firstEnd + 1, targetEnd));
      return {
        inline: createHyperlinkInline(target, parseParagraphSource(first).inlines),
        end: targetEnd + 1,
      };
    }
    if (command === "$" || command === "math") {
      return { inline: createLatexMathInline(first), end: firstEnd + 1 };
    }
    if (command === "code") {
      return { inline: createInlineCode(first), end: firstEnd + 1 };
    }
  } catch {
    return null;
  }
  return null;
}

function parseStyledSource(source: string, inheritedStyle: TextStyle): ParseResult {
  const result: BuilderInlineNode[] = [];
  let converted = false;
  let cursor = 0;
  let plainStart = 0;

  const flush = (end: number): void => {
    appendText(result, unescapeSource(source.slice(plainStart, end)), inheritedStyle);
  };

  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += Math.min(2, source.length - cursor);
      continue;
    }

    let delimiter: string | null = null;
    let style: TextStyle = inheritedStyle;
    if (source.startsWith("***", cursor)) {
      delimiter = "***";
      style = "bold_italic";
    } else if (source.startsWith("**", cursor)) {
      delimiter = "**";
      style = "bold";
    } else if (source[cursor] === "*") {
      delimiter = "*";
      style = "italic";
    }
    if (delimiter !== null) {
      const end = findUnescaped(source, delimiter, cursor + delimiter.length);
      if (end >= 0 && end > cursor + delimiter.length) {
        flush(cursor);
        const nested = parseStyledSource(
          source.slice(cursor + delimiter.length, end),
          style,
        );
        result.push(...nested.inlines);
        converted = true;
        cursor = end + delimiter.length;
        plainStart = cursor;
        continue;
      }
    }

    if (source.startsWith("%$", cursor)) {
      const end = findUnescaped(source, "$%", cursor + 2);
      if (end > cursor + 2) {
        flush(cursor);
        try {
          result.push(createLatexMathInline(source.slice(cursor + 2, end)));
          converted = true;
          cursor = end + 2;
          plainStart = cursor;
          continue;
        } catch {
          // Keep incomplete or invalid source as ordinary editable text.
        }
      }
    }

    if (source.startsWith("§$", cursor)) {
      const end = findUnescaped(source, "$§", cursor + 2);
      if (end > cursor + 2) {
        flush(cursor);
        try {
          result.push(createLatexMathInline(source.slice(cursor + 2, end)));
          converted = true;
          cursor = end + 2;
          plainStart = cursor;
          continue;
        } catch {
          // Keep incomplete or invalid source as ordinary editable text.
        }
      }
    }

    if (source[cursor] === "$") {
      const end = findUnescaped(source, "$", cursor + 1);
      if (end > cursor + 1) {
        flush(cursor);
        try {
          result.push(createLatexMathInline(source.slice(cursor + 1, end)));
          converted = true;
          cursor = end + 1;
          plainStart = cursor;
          continue;
        } catch {
          // Keep invalid LaTeX payloads as text.
        }
      }
    }

    if (source[cursor] === "`") {
      const end = findUnescaped(source, "`", cursor + 1);
      if (end > cursor + 1) {
        flush(cursor);
        result.push(createInlineCode(unescapeSource(source.slice(cursor + 1, end))));
        converted = true;
        cursor = end + 1;
        plainStart = cursor;
        continue;
      }
    }

    if (source[cursor] === "§") {
      const command = commandAt(source, cursor);
      if (command !== null) {
        flush(cursor);
        result.push(command.inline);
        converted = true;
        cursor = command.end;
        plainStart = cursor;
        continue;
      }
    }

    if (source.startsWith("%hyperlink%", cursor)) {
      const labelStart = cursor + "%hyperlink%".length;
      const labelEnd = source.indexOf("%", labelStart);
      const targetEnd = labelEnd < 0 ? -1 : source.indexOf("%", labelEnd + 1);
      if (labelEnd >= 0 && targetEnd > labelEnd + 1) {
        flush(cursor);
        result.push(
          createHyperlinkInline(
            source.slice(labelEnd + 1, targetEnd),
            parseParagraphSource(source.slice(labelStart, labelEnd)).inlines,
          ),
        );
        converted = true;
        cursor = targetEnd + 1;
        plainStart = cursor;
        continue;
      }
    }

    if (source[cursor] === "[") {
      const labelEnd = findUnescaped(source, "](", cursor + 1);
      const targetEnd = labelEnd < 0 ? -1 : findUnescaped(source, ")", labelEnd + 2);
      if (labelEnd > cursor + 1 && targetEnd > labelEnd + 2) {
        flush(cursor);
        const label = source.slice(cursor + 1, labelEnd);
        const target = unescapeSource(source.slice(labelEnd + 2, targetEnd));
        result.push(createHyperlinkInline(target, parseStyledSource(label, "normal").inlines));
        converted = true;
        cursor = targetEnd + 1;
        plainStart = cursor;
        continue;
      }
    }

    cursor += 1;
  }
  flush(source.length);
  return { inlines: Object.freeze(result), converted };
}

export function parseParagraphSource(source: string): ParseResult {
  return parseStyledSource(source, "normal");
}

/** Converts only completed shortcuts in ordinary text runs typed in Write mode. */
export function expandParagraphAuthoringShortcuts(
  inlines: readonly BuilderInlineNode[],
): ParseResult {
  const result: BuilderInlineNode[] = [];
  let converted = false;
  for (const inline of inlines) {
    if (!isTextInline(inline) || inline.style !== "normal") {
      result.push(inline);
      continue;
    }
    const parsed = parseParagraphSource(inline.text);
    if (!parsed.converted) {
      result.push(inline);
      continue;
    }
    converted = true;
    result.push(...parsed.inlines);
  }
  return { inlines: Object.freeze(result), converted };
}
