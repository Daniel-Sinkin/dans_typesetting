// builder/src/app/BlockPalette.tsx — render plugin-contributed document block controls.
import { Sidebar } from "@excalidraw/excalidraw";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import {
  geometryForLayoutMode,
  type DocumentLayoutMode,
  type PageRange,
} from "../builder/layout";
import type { BuilderBlockPlugin, BuilderPluginRegistry } from "../builder/plugin";

interface BlockPaletteProps {
  readonly sidebarName: string;
  readonly blockCount: number;
  readonly semanticBlockCount: number;
  readonly registry: BuilderPluginRegistry;
  readonly layoutMode: DocumentLayoutMode;
  readonly pageRange: PageRange;
  readonly totalPageCount: number;
  readonly transportError: string | null;
  readonly transportStatus: string | null;
  readonly onSaveDocument: () => void;
  readonly onLoadDocument: (file: File) => Promise<void>;
  readonly onLayoutModeChange: (mode: DocumentLayoutMode) => void;
  readonly onPageRangeChange: (range: PageRange) => void;
  readonly onPresent: () => void;
  readonly onBeginDrag: (
    plugin: BuilderBlockPlugin,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
}

export function BlockPalette({
  sidebarName,
  blockCount,
  semanticBlockCount,
  registry,
  layoutMode,
  pageRange,
  totalPageCount,
  transportError,
  transportStatus,
  onSaveDocument,
  onLoadDocument,
  onLayoutModeChange,
  onPageRangeChange,
  onPresent,
  onBeginDrag,
}: BlockPaletteProps) {
  const geometry = geometryForLayoutMode(layoutMode);
  const loadInputRef = useRef<HTMLInputElement>(null);
  return (
    <Sidebar name={sidebarName} docked className="blocks-sidebar">
      <Sidebar.Header>
        <div className="palette-heading">
          <span>Document blocks</span>
          <small>
            {semanticBlockCount} blocks · {blockCount} at root
          </small>
        </div>
      </Sidebar.Header>
      <div className="palette-content">
        <section className="document-file-controls" aria-label="Document files">
          <button type="button" data-testid="save-document" onClick={onSaveDocument}>
            Save document
          </button>
          <button
            type="button"
            data-testid="load-document-button"
            onClick={() => {
              loadInputRef.current?.click();
            }}
          >
            Load document
          </button>
          <input
            ref={loadInputRef}
            className="visually-hidden"
            data-testid="load-document"
            type="file"
            accept=".dans_doc,application/json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file !== undefined) {
                void onLoadDocument(file);
              }
            }}
          />
        </section>
        {transportError === null ? null : (
          <p className="document-file-error" role="alert">
            {transportError}
          </p>
        )}
        {transportError !== null || transportStatus === null ? null : (
          <p className="document-file-status" role="status">
            {transportStatus}
          </p>
        )}
        <section className="layout-mode-controls" aria-label="Document layout mode">
          <label>
            <span>Development view</span>
            <select
              data-testid="layout-mode"
              value={layoutMode}
              onChange={(event) => {
                onLayoutModeChange(event.target.value as DocumentLayoutMode);
              }}
            >
              <option value="continuous">Continuous</option>
              <option value="paged">Paged</option>
              <option value="slides">Slides · 16:9</option>
            </select>
          </label>
          {layoutMode === "continuous" ? (
            <small>Blocks flow through one growing authoring surface.</small>
          ) : (
            <div className="page-range-controls">
              <label>
                <span>First page</span>
                <input
                  data-testid="page-range-start"
                  type="number"
                  min="1"
                  max={totalPageCount}
                  value={pageRange.start}
                  onChange={(event) => {
                    const start = Math.min(
                      totalPageCount,
                      Math.max(1, Number(event.target.value)),
                    );
                    onPageRangeChange({
                      start,
                      end: Math.min(
                        totalPageCount,
                        start + geometry.maximumVisiblePages - 1,
                        Math.max(start, pageRange.end),
                      ),
                    });
                  }}
                />
              </label>
              <label>
                <span>Last page</span>
                <input
                  data-testid="page-range-end"
                  type="number"
                  min={pageRange.start}
                  max={Math.min(
                    totalPageCount,
                    pageRange.start + geometry.maximumVisiblePages - 1,
                  )}
                  value={pageRange.end}
                  onChange={(event) => {
                    onPageRangeChange({
                      start: pageRange.start,
                      end: Math.min(
                        totalPageCount,
                        pageRange.start + geometry.maximumVisiblePages - 1,
                        Math.max(pageRange.start, Number(event.target.value)),
                      ),
                    });
                  }}
                />
              </label>
              <small>
                Showing {pageRange.start}–{pageRange.end} of {totalPageCount}; at most five
                {layoutMode === "slides" ? " slides" : " pages"} are projected.
              </small>
              {layoutMode !== "slides" ? null : (
                <button
                  className="presentation-launch"
                  data-testid="start-presentation"
                  type="button"
                  onClick={onPresent}
                >
                  Present from slide {pageRange.start}
                </button>
              )}
            </div>
          )}
        </section>
        <p className="palette-intro">
          Drag a semantic block into the document flow. Sketches and notes stay in
          Excalidraw.
        </p>
        <div className="palette-grid">
          {registry.palettePlugins().map((plugin) => (
            <button
              className="palette-card"
              key={plugin.typeId}
              type="button"
              onPointerDown={(event) => {
                onBeginDrag(plugin, event);
              }}
            >
              <span
                className="palette-card__glyph"
                style={{ backgroundColor: plugin.palette.accentColor }}
              >
                {plugin.palette.glyph}
              </span>
              <span className="palette-card__copy">
                <strong>{plugin.palette.label}</strong>
                <small>{plugin.palette.description}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="prototype-note">
          <strong>Whole-block pagination</strong>
          <span>Blocks never split across pages; oversized blocks become warnings.</span>
        </div>
      </div>
    </Sidebar>
  );
}
