// builder/src/app/DocumentPage.tsx — project visuals below and controls above Excalidraw.
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import type { DocumentLayout } from "../builder/layout";
import type { BuilderPluginRegistry } from "../builder/plugin";
import { deriveBlockOrdinals } from "../builder/numbering";
import type { BuilderBlock } from "../model/document";

interface DocumentVisualPageProps {
  readonly layout: DocumentLayout;
  readonly pageStyle: CSSProperties;
  readonly registry: BuilderPluginRegistry;
}

function blockPositionStyle(
  layout: DocumentLayout,
  bounds: Readonly<{ x: number; y: number; width: number; height: number }>,
): CSSProperties {
  return {
    width: bounds.width,
    height: bounds.height,
    transform: `translate3d(${String(bounds.x - layout.pageBounds.x)}px, ${String(bounds.y - layout.pageBounds.y)}px, 0)`,
  };
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
  return (
    <article className="document-page" style={pageStyle} aria-label="Fixed document page">
      <header className="document-page__header">
        <span>DOCUMENT 01</span>
        <span>GROWING PAGE PROTOTYPE</span>
      </header>

      {layout.blocks.map(({ block, bounds }, documentIndex) => {
        const adapter = registry.pluginForBlock(block);
        const numbering = ordinals.get(block.id) ?? {
          numberingSeries: null,
          ordinal: null,
        };
        return (
          <section
            className="document-block-visual"
            data-visual-block-id={block.id}
            key={block.id}
            style={blockPositionStyle(layout, bounds)}
          >
            <div className="document-block__content">
              {adapter.renderPreview(block, {
                documentIndex,
                numberingSeries: numbering.numberingSeries,
                ordinal: numbering.ordinal,
              })}
            </div>
          </section>
        );
      })}

      {layout.previewBounds === null ? null : (
        <div
          className="insertion-preview"
          style={blockPositionStyle(layout, layout.previewBounds)}
        >
          <span>Drop block here</span>
        </div>
      )}

      {layout.blocks.length === 0 && layout.previewBounds === null ? (
        <div className="empty-page-message">Drag a block here to begin the document.</div>
      ) : null}
    </article>
  );
}

interface DocumentControlsProps {
  readonly layout: DocumentLayout;
  readonly pageStyle: CSSProperties;
  readonly registry: BuilderPluginRegistry;
  readonly onBeginMove: (
    block: BuilderBlock,
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
      {layout.blocks.map(({ block, bounds }, index) => {
        const adapter = registry.pluginForBlock(block);
        return (
          <section
            className="document-block-controls"
            data-block-id={block.id}
            key={block.id}
            style={blockPositionStyle(layout, bounds)}
          >
            <div className="document-block__toolbar">
              <button
                className="document-block__grip"
                type="button"
                aria-label={`Move ${adapter.palette.label} block`}
                title="Drag to reorder; hold Alt to copy"
                onPointerDown={(event) => {
                  onBeginMove(block, index, event);
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
