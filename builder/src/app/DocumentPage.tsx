// Project paged/continuous document visuals below Excalidraw and controls above it.
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import type { DocumentLayout, LayoutBounds } from "../builder/layout";
import type { BuilderPluginRegistry } from "../builder/plugin";
import { deriveBlockOrdinals } from "../builder/numbering";
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
  const ordinals = deriveBlockOrdinals(
    layout.blocks.map(({ block }) => block),
    (block) => registry.pluginForBlock(block).numberingSeries ?? null,
  );
  const visibleBlocks = layout.blocks
    .map((blockLayout, documentIndex) => ({ blockLayout, documentIndex }))
    .filter(({ blockLayout }) => isPageVisible(layout, blockLayout.pageIndex));
  return (
    <div className="document-surface" style={pageStyle} aria-label="Document development view">
      {layout.pages
        .filter((page) => page.visible)
        .map((page) => (
          <article
            className="document-page"
            data-page-number={page.pageIndex + 1}
            key={page.pageIndex}
            style={positionStyle(layout, page.bounds)}
            aria-label={`Document page ${String(page.pageIndex + 1)}`}
          >
            <header className="document-page__header">
              <span>DOCUMENT {String(page.pageIndex + 1).padStart(2, "0")}</span>
              <span>{layout.mode === "continuous" ? "CONTINUOUS VIEW" : "PAGED VIEW"}</span>
            </header>
          </article>
        ))}

      {visibleBlocks.map(({ blockLayout, documentIndex }) => {
        const { block, bounds, depth, oversized } = blockLayout;
        const adapter = registry.pluginForBlock(block);
        const numbering = ordinals.get(block.id) ?? {
          numberingSeries: null,
          ordinal: null,
        };
        return (
          <section
            className={`document-block-visual${oversized ? " document-block-visual--oversized" : ""}`}
            data-section-depth={depth}
            data-visual-block-id={block.id}
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
}

export function DocumentControls({
  layout,
  pageStyle,
  registry,
  onBeginMove,
  onDelete,
  onEdit,
}: DocumentControlsProps) {
  return (
    <div className="document-controls" style={pageStyle} aria-label="Document block controls">
      {layout.blocks
        .filter(({ pageIndex }) => isPageVisible(layout, pageIndex))
        .map(({ block, bounds, parentId, siblingIndex, depth }) => {
          const adapter = registry.pluginForBlock(block);
          return (
            <section
              className="document-block-controls"
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
                    onClick={() => {
                      onEdit(block);
                    }}
                  >
                    Edit
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
            </section>
          );
        })}
    </div>
  );
}
