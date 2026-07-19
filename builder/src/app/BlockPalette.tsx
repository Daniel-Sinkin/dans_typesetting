// builder/src/app/BlockPalette.tsx — render plugin-contributed document block controls.
import { Sidebar } from "@excalidraw/excalidraw";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { BuilderBlockPlugin, BuilderPluginRegistry } from "../builder/plugin";

interface BlockPaletteProps {
  readonly sidebarName: string;
  readonly blockCount: number;
  readonly registry: BuilderPluginRegistry;
  readonly transportError: string | null;
  readonly onSaveDocument: () => void;
  readonly onLoadDocument: (file: File) => Promise<void>;
  readonly onBeginDrag: (
    plugin: BuilderBlockPlugin,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
}

export function BlockPalette({
  sidebarName,
  blockCount,
  registry,
  transportError,
  onSaveDocument,
  onLoadDocument,
  onBeginDrag,
}: BlockPaletteProps) {
  return (
    <Sidebar name={sidebarName} docked className="blocks-sidebar">
      <Sidebar.Header>
        <div className="palette-heading">
          <span>Document blocks</span>
          <small>{blockCount} on page</small>
        </div>
      </Sidebar.Header>
      <div className="palette-content">
        <section className="document-file-controls" aria-label="Document files">
          <button type="button" data-testid="save-document" onClick={onSaveDocument}>
            Save document
          </button>
          <label>
            <span>Load document</span>
            <input
              className="visually-hidden"
              data-testid="load-document"
              type="file"
              accept=".json,.dans.json,application/json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file !== undefined) {
                  void onLoadDocument(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </label>
        </section>
        {transportError === null ? null : (
          <p className="document-file-error" role="alert">
            {transportError}
          </p>
        )}
        <p className="palette-intro">
          Drag a semantic block onto the fixed page. Sketches and notes stay in Excalidraw.
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
              <span className="palette-card__drag" aria-hidden="true">
                ⠿
              </span>
            </button>
          ))}
        </div>
        <div className="prototype-note">
          <strong>One-page prototype</strong>
          <span>Pagination and movable document surfaces come later.</span>
        </div>
      </div>
    </Sidebar>
  );
}
