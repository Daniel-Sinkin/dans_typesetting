// Project paged/continuous document visuals below Excalidraw and controls above it.
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import {
  geometryForLayoutMode,
  type DocumentLayout,
  type LayoutBounds,
} from "../builder/layout";
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
  readonly layer?: "all" | "background" | "blocks";
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
  layer = "all",
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
  const showBackground = layer !== "blocks";
  const showBlocks = layer !== "background";
  const previewDepth = layout.previewDepth ?? 0;
  return (
    <div
      className={`document-surface document-surface--${layout.mode}`}
      style={pageStyle}
      aria-label={layout.mode === "slides" ? "Slide development view" : "Document development view"}
    >
      {showBackground ? layout.pages
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
        )) : null}

      {showBlocks ? visibleBlocks.map(({ blockLayout, documentIndex }) => {
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
            data-visual-block-type={block.typeId}
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
                  childSequenceLayouts: layout.childSequenceLayouts
                    .filter(({ parentId }) => parentId === block.id)
                    .map(({ sequenceId, bounds: childBounds }) => ({
                      sequenceId,
                      offsetX: childBounds.x - bounds.x,
                      offsetY: childBounds.y - bounds.y,
                      width: childBounds.width,
                      height: childBounds.height,
                    })),
                })
              )}
            </div>
          </section>
        );
      }) : null}

      {!showBlocks || layout.previewBounds === null ||
      layout.previewPageIndex === null ||
      !isPageVisible(layout, layout.previewPageIndex) ? null : (
        <div className="insertion-preview" style={positionStyle(layout, layout.previewBounds)}>
          {previewDepth === 0 ? null : (
            <div className="insertion-preview__depth-guides" aria-hidden="true">
              {Array.from({ length: previewDepth }, (_, index) => (
                <i
                  key={index}
                  style={{
                    left:
                      -(previewDepth - index) *
                      geometryForLayoutMode(layout.mode).sectionIndent,
                  }}
                />
              ))}
            </div>
          )}
          <span className="insertion-preview__label">Drop block here</span>
        </div>
      )}

      {showBlocks && visibleBlocks.length === 0 && layout.previewBounds === null ? (
        <div className="empty-page-message">Drag a block here to begin the document.</div>
      ) : null}
    </div>
  );
}

interface DocumentControlsProps {
  readonly layout: DocumentLayout;
  readonly pageStyle: CSSProperties;
  readonly registry: BuilderPluginRegistry;
  readonly selectedBlockIds: ReadonlySet<string>;
  readonly onBlockPointerDown: (
    block: BuilderBlock,
    parentId: string | null,
    parentSequenceId: string | null,
    index: number,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  readonly onDeleteSelected: () => void;
  readonly onEdit: (block: BuilderBlock) => void;
  readonly onBlockKeyDown: (
    block: BuilderBlock,
    event: ReactKeyboardEvent<HTMLElement>,
  ) => void;
  readonly onOpenContextMenu: (
    block: BuilderBlock,
    clientX: number,
    clientY: number,
  ) => void;
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
  selectedBlockIds,
  onBlockPointerDown,
  onDeleteSelected,
  onEdit,
  onBlockKeyDown,
  onOpenContextMenu,
  inlineEditor,
}: DocumentControlsProps) {
  return (
    <div className="document-controls" style={pageStyle} aria-label="Document block controls">
      {layout.blocks
        .filter(({ pageIndex }) => isPageVisible(layout, pageIndex))
        .map(({ block, bounds, parentId, parentSequenceId, siblingIndex, depth }) => {
          const adapter = registry.pluginForBlock(block);
          const activeEditor = inlineEditor?.blockId === block.id ? inlineEditor : null;
          const selected = selectedBlockIds.has(block.id);
          return (
            <section
              className={`document-block-controls${selected ? " document-block-controls--selected" : ""}${activeEditor === null ? "" : " document-block-controls--editing"}`}
              data-block-id={block.id}
              data-block-type={block.typeId}
              data-section-depth={depth}
              key={block.id}
              style={positionStyle(layout, bounds)}
              tabIndex={0}
              aria-selected={selected}
              aria-label={`${adapter.palette.label} block`}
              onPointerDown={(event) => {
                if (
                  event.target instanceof Element &&
                  event.target.closest(".inline-block-editor, button, input, textarea, select") !== null
                ) {
                  return;
                }
                onBlockPointerDown(
                  block,
                  parentId,
                  parentSequenceId,
                  siblingIndex,
                  event,
                );
              }}
              onDoubleClick={(event) => {
                if (
                  event.target instanceof Element &&
                  event.target.closest(".inline-block-editor, button, input, textarea, select") !== null
                ) {
                  return;
                }
                event.preventDefault();
                onEdit(block);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenContextMenu(block, event.clientX, event.clientY);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) {
                  return;
                }
                if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                  event.preventDefault();
                  const rectangle = event.currentTarget.getBoundingClientRect();
                  onOpenContextMenu(
                    block,
                    rectangle.left + rectangle.width / 2,
                    rectangle.top + rectangle.height / 2,
                  );
                  return;
                }
                onBlockKeyDown(block, event);
              }}
            >
              {selected ? (
                <div className="document-block__selection-label">
                  <button
                    type="button"
                    aria-label="Delete selected blocks"
                    title="Delete selected blocks"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteSelected();
                    }}
                  >
                    ×
                  </button>
                  <span>{adapter.palette.label}</span>
                </div>
              ) : null}
              {activeEditor === null ? null : (
                <div
                  className="inline-block-editor"
                  aria-label={activeEditor.title}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {activeEditor.content}
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
}
