// Project paged/continuous document visuals below Excalidraw and controls above it.
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import type { DocumentLayout, LayoutBounds } from "../builder/layout";
import type { BuilderPluginRegistry } from "../builder/plugin";
import {
  deriveInlineOrdinals,
  deriveNumberedBlockOrdinals,
} from "../builder/numbering";
import { deriveReferenceTargets } from "../builder/referenceTargets";
import { blockAnchorId } from "../builder/reference";
import { deriveDocumentResources } from "../builder/documentResources";
import type { BuilderBlock } from "../model/document";

interface DocumentVisualPageProps {
  readonly layout: DocumentLayout;
  readonly pageStyle: CSSProperties;
  readonly registry: BuilderPluginRegistry;
}

function positionStyle(layout: DocumentLayout, bounds: LayoutBounds): CSSProperties {
  return {
    width: bounds.width,
    height: bounds.height,
    transform: `translate3d(${String(bounds.x - layout.pageBounds.x)}px, ${String(bounds.y - layout.pageBounds.y)}px, 0)`,
  };
}

function isPageVisible(layout: DocumentLayout, pageIndex: number): boolean {
  return layout.pages[pageIndex]?.visible ?? false;
}

export function DocumentVisualPage({
  layout,
  pageStyle,
  registry,
}: DocumentVisualPageProps) {
  const ordinals = deriveNumberedBlockOrdinals(
    layout.blocks.map(({ block }) => block),
    (block) => registry.numberedOccurrencesForBlock(block),
  );
  const referenceTargets = deriveReferenceTargets(layout.documentBlocks, registry);
  const inlineOrdinals = deriveInlineOrdinals(layout.documentBlocks, registry);
  const documentResources = deriveDocumentResources(layout.documentBlocks, registry);
  const visibleBlocks = layout.blocks
    .map((blockLayout, documentIndex) => ({ blockLayout, documentIndex }))
    .filter(({ blockLayout }) => isPageVisible(layout, blockLayout.pageIndex));
  return (
    <div
      className={`document-surface document-surface--${layout.mode}`}
      style={pageStyle}
      aria-label={layout.mode === "slides" ? "Slide development view" : "Document development view"}
    >
      {layout.pages
        .filter((page) => page.visible)
        .map((page) => (
          <article
            className={`document-page${layout.mode === "slides" ? " document-page--slide" : ""}`}
            data-page-number={page.pageIndex + 1}
            key={page.pageIndex}
            style={positionStyle(layout, page.bounds)}
            aria-label={`${layout.mode === "slides" ? "Slide" : "Document page"} ${String(page.pageIndex + 1)}`}
          >
            <header className="document-page__header">
              <span>
                {layout.mode === "slides" ? "SLIDE" : "DOCUMENT"}{" "}
                {String(page.pageIndex + 1).padStart(2, "0")}
              </span>
              <span>
                {layout.mode === "continuous"
                  ? "CONTINUOUS VIEW"
                  : layout.mode === "slides"
                    ? "16:9 SLIDE"
                    : "PAGED VIEW"}
              </span>
            </header>
          </article>
        ))}

      {visibleBlocks.map(({ blockLayout, documentIndex }) => {
        const { block, bounds, depth, oversized } = blockLayout;
        const adapter = registry.pluginForBlock(block);
        const primaryOccurrence = registry.numberedOccurrencesForBlock(block)[0];
        const numbering = (primaryOccurrence === undefined
          ? undefined
          : ordinals.get(primaryOccurrence.occurrenceId)) ?? {
          numberingSeries: null,
          ordinal: null,
        };
        const target = [...referenceTargets.values()].find(
          (candidate) =>
            candidate.blockId === block.id && candidate.occurrenceId === block.id,
        );
        return (
          <section
            className={`document-block-visual${oversized ? " document-block-visual--oversized" : ""}`}
            data-section-depth={depth}
            data-visual-block-id={block.id}
            id={target?.anchorId ?? blockAnchorId(block.id)}
            key={block.id}
            style={positionStyle(layout, bounds)}
          >
            <div className="document-block__content">
              {oversized ? (
                <div className="oversized-block-warning" role="alert">
                  <strong>WARNING · BLOCK TOO LARGE FOR ONE PAGE</strong>
                  <span>{adapter.palette.label}</span>
                  <code>{block.id}</code>
                </div>
              ) : (
                adapter.renderPreview(block, {
                  documentIndex,
                  numberingSeries: numbering.numberingSeries,
                  ordinal: numbering.ordinal,
                  documentBlocks: layout.documentBlocks,
                  sectionDepth: depth,
                  referenceTargets,
                  inlineOrdinals,
                  blockOrdinals: ordinals,
                  documentResources,
                })
              )}
            </div>
          </section>
        );
      })}

      {layout.previewBounds === null ||
      layout.previewPageIndex === null ||
      !isPageVisible(layout, layout.previewPageIndex) ? null : (
        <div className="insertion-preview" style={positionStyle(layout, layout.previewBounds)}>
          <span>Drop block here</span>
        </div>
      )}

      {visibleBlocks.length === 0 && layout.previewBounds === null ? (
        <div className="empty-page-message">Drag a block here to begin the document.</div>
      ) : null}
    </div>
  );
}

interface DocumentControlsProps {
  readonly layout: DocumentLayout;
  readonly pageStyle: CSSProperties;
  readonly registry: BuilderPluginRegistry;
  readonly onBeginMove: (
    block: BuilderBlock,
    parentId: string | null,
    index: number,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  readonly onDelete: (blockId: string) => void;
  readonly onEdit: (block: BuilderBlock) => void;
  readonly inlineEditor: Readonly<{
    blockId: string;
    title: string;
    content: ReactNode;
  }> | null;
}

export function DocumentControls({
  layout,
  pageStyle,
  registry,
  onBeginMove,
  onDelete,
  onEdit,
  inlineEditor,
}: DocumentControlsProps) {
  return (
    <div className="document-controls" style={pageStyle} aria-label="Document block controls">
      {layout.blocks
        .filter(({ pageIndex }) => isPageVisible(layout, pageIndex))
        .map(({ block, bounds, parentId, siblingIndex, depth }) => {
          const adapter = registry.pluginForBlock(block);
          const activeEditor = inlineEditor?.blockId === block.id ? inlineEditor : null;
          return (
            <section
              className={`document-block-controls${activeEditor === null ? "" : " document-block-controls--editing"}`}
              data-block-id={block.id}
              data-section-depth={depth}
              key={block.id}
              style={positionStyle(layout, bounds)}
            >
              <div className="document-block__toolbar">
                <button
                  className="document-block__grip"
                  type="button"
                  aria-label={`Move ${adapter.palette.label} block`}
                  title="Drag to reorder or nest; hold Alt to copy"
                  onPointerDown={(event) => {
                    onBeginMove(block, parentId, siblingIndex, event);
                  }}
                >
                  ⠿
                </button>
                <span>{adapter.palette.label}</span>
                <code>{block.id}</code>
                <div className="document-block__actions">
                  <button
                    type="button"
                    disabled={activeEditor !== null}
                    onClick={() => {
                      onEdit(block);
                    }}
                  >
                    {activeEditor === null ? "Edit" : "Editing"}
                  </button>
                  <button
                    className="danger-action"
                    type="button"
                    onClick={() => {
                      onDelete(block.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {activeEditor === null ? null : (
                <div className="inline-block-editor" aria-label={activeEditor.title}>
                  {activeEditor.content}
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
}
