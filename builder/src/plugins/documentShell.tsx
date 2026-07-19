// Browser adapters for semantic title, ToC, page-break, and section blocks.
import type {
  BuilderBlockPlugin,
  BuilderBlockRenderContext,
} from "../builder/plugin";
import {
  isPageBreakBlock,
  isSectionBlock,
  isTableOfContentsBlock,
  isTitlePageBlock,
  pageBreakTypeId,
  sectionBody,
  sectionBodySequenceId,
  sectionTypeId,
  tableOfContentsTypeId,
  titlePageTypeId,
  type BuilderBlock,
  type SectionBlock,
  type TitlePageBlock,
} from "../model/document";
import { SectionEditor, TitlePageEditor } from "./documentShellEditors";
import { blockAnchorId } from "../builder/reference";

function requireSection(block: BuilderBlock): SectionBlock {
  if (!isSectionBlock(block)) {
    throw new Error(`Section plugin cannot consume ${block.typeId}`);
  }
  return block;
}

function requireTitlePage(block: BuilderBlock): TitlePageBlock {
  if (!isTitlePageBlock(block)) {
    throw new Error(`Title-page plugin cannot consume ${block.typeId}`);
  }
  return block;
}

export interface TocEntry {
  readonly id: string;
  readonly title: string;
  readonly depth: number;
  readonly number: string;
}

export function deriveTableOfContentsEntries(
  blocks: readonly BuilderBlock[],
): readonly TocEntry[] {
  const result: TocEntry[] = [];
  const counters = [0, 0, 0, 0, 0];
  const visit = (sequence: readonly BuilderBlock[], depth: number): void => {
    for (const block of sequence) {
      if (!isSectionBlock(block)) {
        continue;
      }
      counters[depth] = (counters[depth] ?? 0) + 1;
      counters.fill(0, depth + 1);
      result.push({
        id: block.id,
        title: block.title,
        depth,
        number: counters.slice(0, depth + 1).join("."),
      });
      visit(sectionBody(block), depth + 1);
    }
  };
  visit(blocks, 0);
  return result;
}

export const titlePagePlugin: BuilderBlockPlugin = {
  typeId: titlePageTypeId,
  paginationPolicy: "isolated_page",
  palette: {
    label: "Title page",
    description: "A semantic title, author, and date page",
    glyph: "T",
    accentColor: "#7048e8",
  },
  createDefault(blockId) {
    return Object.freeze({
      id: blockId,
      typeId: titlePageTypeId,
      title: "Untitled document",
      author: "Daniel Sinkin",
      date: new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date()),
    });
  },
  measure() {
    return 620;
  },
  renderPreview(block) {
    const titlePage = requireTitlePage(block);
    return (
      <div className="title-page-content">
        <h1>{titlePage.title}</h1>
        <p>{titlePage.author}</p>
        <time>{titlePage.date}</time>
      </div>
    );
  },
  editor: {
    title: (block) => `Edit title page · ${requireTitlePage(block).id}`,
    render: (props) => <TitlePageEditor {...props} />,
  },
};

export const tableOfContentsPlugin: BuilderBlockPlugin = {
  typeId: tableOfContentsTypeId,
  palette: {
    label: "Table of contents",
    description: "A live index derived from section structure",
    glyph: "≡",
    accentColor: "#5f3dc4",
  },
  createDefault(blockId) {
    return Object.freeze({ id: blockId, typeId: tableOfContentsTypeId });
  },
  measure(block, availableWidth, context) {
    if (!isTableOfContentsBlock(block) || availableWidth <= 0) {
      throw new Error("Table-of-contents measurement received invalid input");
    }
    return Math.max(250, 92 + deriveTableOfContentsEntries(context.documentBlocks).length * 28);
  },
  renderPreview(block, context: BuilderBlockRenderContext) {
    if (!isTableOfContentsBlock(block)) {
      throw new Error(`Table-of-contents plugin cannot consume ${block.typeId}`);
    }
    const entries = deriveTableOfContentsEntries(context.documentBlocks);
    return (
      <nav className="toc-content" aria-label="Table of contents preview">
        <h2>Contents</h2>
        {entries.length === 0 ? (
          <p>No sections yet.</p>
        ) : (
          <ol>
            {entries.map((entry) => (
              <li key={entry.id} style={{ paddingLeft: `${String(entry.depth * 22)}px` }}>
                <a href={`#${blockAnchorId(entry.id)}`}>
                  <span>{entry.number}</span>
                  <span>{entry.title}</span>
                </a>
                <i aria-hidden="true" />
                <small>—</small>
              </li>
            ))}
          </ol>
        )}
      </nav>
    );
  },
};

export const pageBreakPlugin: BuilderBlockPlugin = {
  typeId: pageBreakTypeId,
  paginationPolicy: "page_break_after",
  palette: {
    label: "Page break",
    description: "Force following content onto a fresh page",
    glyph: "↵",
    accentColor: "#868e96",
  },
  createDefault(blockId) {
    return Object.freeze({ id: blockId, typeId: pageBreakTypeId });
  },
  measure() {
    return 38;
  },
  renderPreview(block) {
    if (!isPageBreakBlock(block)) {
      throw new Error(`Page-break plugin cannot consume ${block.typeId}`);
    }
    return (
      <div className="page-break-content">
        <span>Explicit page break</span>
      </div>
    );
  },
};

export const sectionPlugin: BuilderBlockPlugin = {
  typeId: sectionTypeId,
  palette: {
    label: "Section",
    description: "A referenceable heading with a nested block sequence",
    glyph: "§",
    accentColor: "#e8590c",
  },
  createDefault(blockId) {
    return Object.freeze({
      id: blockId,
      typeId: sectionTypeId,
      title: "New section",
      referenceId: null,
      childSequences: Object.freeze([
        Object.freeze({ id: sectionBodySequenceId, blocks: Object.freeze([]) }),
      ]),
    });
  },
  referenceTarget(block) {
    const section = requireSection(block);
    return {
      referenceId: section.referenceId,
      label: "Section",
      title: section.title,
    };
  },
  copyForInsert(block, copiedBlockId) {
    return Object.freeze({
      ...requireSection(block),
      id: copiedBlockId,
      referenceId: null,
    });
  },
  measure() {
    return 82;
  },
  renderPreview(block, context) {
    const section = requireSection(block);
    const level = Math.min(5, context.sectionDepth + 1);
    return (
      <div className={`section-heading section-heading--${String(level)}`}>
        <span>{"§".repeat(level)}</span>
        <h2>{section.title}</h2>
        {section.referenceId === null ? null : <code>{section.referenceId}</code>}
      </div>
    );
  },
  editor: {
    title: (block) => `Edit section · ${requireSection(block).id}`,
    render: (props) => <SectionEditor {...props} />,
  },
};
