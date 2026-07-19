// Register bibliography blocks and citation inlines with the graphical writer.
import { createElement } from "react";

import type { BuilderInlinePlugin } from "../builder/inlinePlugin";
import type { BuilderBlockPlugin } from "../builder/plugin";
import {
  bibliographyResourceNamespace,
  bibliographyTypeId,
  citationInlineTypeId,
  createBibliographyBlock,
  createBibliographyEntry,
  createCitationInline,
  requireBibliographyBlock,
  requireCitationInline,
} from "./bibliographyModel";
import {
  BibliographyEditor,
  BibliographyPreview,
  CitationEditor,
  CitationPreview,
} from "./bibliographyView";
import type { BibliographySourceCapability } from "./bibliographySources";

export function createBibliographyPlugin(
  sourceCapability?: BibliographySourceCapability,
): BuilderBlockPlugin {
  return {
    typeId: bibliographyTypeId,
    palette: {
      label: "References",
      description: "A normalized, numbered bibliography",
      glyph: "≣",
      accentColor: "#9c36b5",
    },
    createDefault(blockId) {
      return createBibliographyBlock(
        [
          createBibliographyEntry({
            key: "reference",
            kind: "miscellaneous",
            title: "New bibliography entry",
          }),
        ],
        blockId,
      );
    },
    documentResources(block) {
      return requireBibliographyBlock(block).entries.map((entry) => ({
        namespace: bibliographyResourceNamespace,
        key: entry.key,
        value: entry,
      }));
    },
    copyForInsert(block, copiedBlockId) {
      const bibliography = requireBibliographyBlock(block);
      return createBibliographyBlock(
        bibliography.entries.map((entry) =>
          createBibliographyEntry({
            ...entry,
            id: globalThis.crypto.randomUUID(),
            key: `${entry.key}-copy-${copiedBlockId}`,
          }),
        ),
        copiedBlockId,
      );
    },
    measure(block, availableWidth) {
      const bibliography = requireBibliographyBlock(block);
      const charactersPerLine = Math.max(24, Math.floor(availableWidth / 9));
      const lines = bibliography.entries.reduce(
        (total, entry) =>
          total +
          Math.max(
            1,
            Math.ceil(
              `${entry.authors.join("; ")} ${entry.title} ${entry.venue ?? ""} ${entry.publisher ?? ""}`.length /
                charactersPerLine,
            ),
          ),
        0,
      );
      return 90 + bibliography.entries.length * 16 + lines * 24;
    },
    renderPreview(block, context) {
      return createElement(BibliographyPreview, {
        bibliography: requireBibliographyBlock(block),
        context,
      });
    },
    editor: {
      title(block) {
        return `Edit references · ${requireBibliographyBlock(block).id}`;
      },
      render(props) {
        return createElement(BibliographyEditor, { ...props, sourceCapability });
      },
    },
  };
}

export const citationInlinePlugin: BuilderInlinePlugin = {
  typeId: citationInlineTypeId,
  palette: {
    label: "Citation",
    description: "One or more live bibliography citations",
    glyph: "[1]",
    accentColor: "#862e9c",
  },
  createDefault(inlineId) {
    return createCitationInline(["reference"], inlineId);
  },
  plainText(inline) {
    return `[${requireCitationInline(inline).keys.join(", ")}]`;
  },
  renderPreview(inline, _registry, context) {
    return createElement(CitationPreview, { inline, context });
  },
  editor: {
    render(props) {
      return createElement(CitationEditor, props);
    },
  },
};

export {
  bibliographyResourceNamespace,
  bibliographyTypeId,
  citationInlineTypeId,
  createBibliographyBlock,
  createBibliographyEntry,
  createCitationInline,
} from "./bibliographyModel";
