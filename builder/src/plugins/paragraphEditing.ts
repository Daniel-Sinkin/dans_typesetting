// Convert the browser paragraph-composer DOM back into the semantic Inline Sequence.
import {
  createBlockId,
  createText,
  type BuilderInlineNode,
  type TextStyle,
} from "../model/document";

export const paragraphTextIdAttribute = "data-paragraph-text-id";
export const paragraphTextStyleAttribute = "data-paragraph-text-style";
export const paragraphAtomIdAttribute = "data-paragraph-atom-id";

interface TextFlags {
  readonly bold: boolean;
  readonly italic: boolean;
}

interface TextPiece {
  readonly kind: "text";
  text: string;
  readonly style: TextStyle;
  readonly preferredId: string | null;
}

interface AtomPiece {
  readonly kind: "atom";
  readonly inline: BuilderInlineNode;
}

type ComposerPiece = TextPiece | AtomPiece;

const blockElementNames = new Set(["DIV", "P"]);
const browserTextNodeIds = new WeakMap<Text, string>();

function flagsForStyle(style: TextStyle): TextFlags {
  return {
    bold: style === "bold" || style === "bold_italic",
    italic: style === "italic" || style === "bold_italic",
  };
}

function styleForFlags(flags: TextFlags): TextStyle {
  if (flags.bold && flags.italic) {
    return "bold_italic";
  }
  if (flags.bold) {
    return "bold";
  }
  return flags.italic ? "italic" : "normal";
}

function textStyleAttribute(element: Element): TextStyle | null {
  const value = element.getAttribute(paragraphTextStyleAttribute);
  return value === "normal" ||
    value === "bold" ||
    value === "italic" ||
    value === "bold_italic"
    ? value
    : null;
}

function flagsForElement(element: HTMLElement, inherited: TextFlags): TextFlags {
  const declaredStyle = textStyleAttribute(element);
  let bold = declaredStyle === null ? inherited.bold : flagsForStyle(declaredStyle).bold;
  let italic =
    declaredStyle === null ? inherited.italic : flagsForStyle(declaredStyle).italic;

  if (element.tagName === "B" || element.tagName === "STRONG") {
    bold = true;
  }
  if (element.tagName === "I" || element.tagName === "EM") {
    italic = true;
  }

  const fontWeight = element.style.fontWeight;
  if (fontWeight === "normal" || fontWeight === "400") {
    bold = false;
  } else if (fontWeight === "bold" || Number(fontWeight) >= 600) {
    bold = true;
  }
  if (element.style.fontStyle === "normal") {
    italic = false;
  } else if (element.style.fontStyle === "italic") {
    italic = true;
  }
  return { bold, italic };
}

function appendText(
  pieces: ComposerPiece[],
  text: string,
  style: TextStyle,
  preferredId: string | null,
): void {
  if (text.length === 0) {
    return;
  }
  const previous = pieces.at(-1);
  if (
    previous?.kind === "text" &&
    previous.style === style &&
    previous.preferredId === preferredId
  ) {
    previous.text += text;
    return;
  }
  pieces.push({ kind: "text", text, style, preferredId });
}

function endsWithLineBreak(pieces: readonly ComposerPiece[]): boolean {
  const last = pieces.at(-1);
  return last?.kind === "text" && last.text.endsWith("\n");
}

/**
 * Reads only composer-owned markers. Atomic nodes retain their exact payload,
 * while browser-created formatting elements are lowered into Core Text runs.
 */
export function readParagraphComposerInlines(
  root: HTMLElement,
  currentInlines: readonly BuilderInlineNode[],
): readonly BuilderInlineNode[] {
  const currentById = new Map(currentInlines.map((inline) => [inline.id, inline]));
  const pieces: ComposerPiece[] = [];
  const claimedTextIds = new Set<string>();

  const visit = (
    node: Node,
    flags: TextFlags,
    preferredId: string | null,
  ): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      let resolvedId = browserTextNodeIds.get(textNode);
      if (resolvedId === undefined) {
        resolvedId =
          preferredId !== null && !claimedTextIds.has(preferredId)
            ? preferredId
            : createBlockId();
        browserTextNodeIds.set(textNode, resolvedId);
      }
      claimedTextIds.add(resolvedId);
      appendText(pieces, textNode.data, styleForFlags(flags), resolvedId);
      return;
    }
    if (!(node instanceof HTMLElement)) {
      return;
    }

    const atomId = node.getAttribute(paragraphAtomIdAttribute);
    if (atomId !== null) {
      const inline = currentById.get(atomId);
      if (inline !== undefined) {
        pieces.push({ kind: "atom", inline });
      }
      return;
    }
    if (node.tagName === "BR") {
      appendText(pieces, "\n", styleForFlags(flags), preferredId);
      return;
    }

    const nextFlags = flagsForElement(node, flags);
    const nextPreferredId = node.getAttribute(paragraphTextIdAttribute) ?? preferredId;
    for (const child of node.childNodes) {
      visit(child, nextFlags, nextPreferredId);
    }
    if (
      blockElementNames.has(node.tagName) &&
      node.nextSibling !== null &&
      pieces.length > 0 &&
      !endsWithLineBreak(pieces)
    ) {
      const previous = pieces.at(-1);
      appendText(
        pieces,
        "\n",
        styleForFlags(nextFlags),
        previous?.kind === "text" ? previous.preferredId : nextPreferredId,
      );
    }
  };

  for (const child of root.childNodes) {
    visit(child, { bold: false, italic: false }, null);
  }

  const usedIds = new Set<string>();
  const result: BuilderInlineNode[] = [];
  for (const piece of pieces) {
    if (piece.kind === "atom") {
      if (!usedIds.has(piece.inline.id)) {
        usedIds.add(piece.inline.id);
        result.push(piece.inline);
      }
      continue;
    }
    const id =
      piece.preferredId !== null && !usedIds.has(piece.preferredId)
        ? piece.preferredId
        : createBlockId();
    usedIds.add(id);
    result.push(createText(piece.text, id, piece.style));
  }
  return Object.freeze(result);
}
