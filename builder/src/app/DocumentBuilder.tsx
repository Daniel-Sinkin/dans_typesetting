// builder/src/app/DocumentBuilder.tsx — host a growing document beneath an Excalidraw canvas.
import {
  CaptureUpdateAction,
  Excalidraw,
  Footer,
  Sidebar,
  newElementWith,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import type { AppState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  computeDocumentLayout,
  insertionIndexAtSceneY,
  isInsideDocumentColumn,
  type InsertionPreview,
} from "../builder/layout";
import type { BuilderBlockPlugin, BuilderPluginRegistry } from "../builder/plugin";
import { createPageAnchor, pageAnchorId } from "../canvas/pageAnchor";
import {
  cloneBuilderBlock,
  createBlockId,
  type BuilderBlock,
  type DocumentPort,
} from "../model/document";
import type { CanonicalDocumentTransport } from "../transport/documentTransport";
import { BlockPalette } from "./BlockPalette";
import { DetachConfirmation } from "./DetachConfirmation";
import { DocumentControls, DocumentVisualPage } from "./DocumentPage";
import { DragGhost } from "./DragGhost";
import { EditorDialog } from "./EditorDialog";

const blocksSidebarName = "document-blocks";
const detachWithoutAskingPreference = "dans-typesetting.delete-detached-without-asking";
const pageAnchor = createPageAnchor();

interface DocumentBuilderProps {
  readonly port: DocumentPort;
  readonly registry: BuilderPluginRegistry;
  readonly transport: CanonicalDocumentTransport;
}

interface CanvasViewport {
  readonly zoom: AppState["zoom"];
  readonly offsetLeft: number;
  readonly offsetTop: number;
  readonly scrollX: number;
  readonly scrollY: number;
}

interface Placement {
  readonly index: number;
}

type ActiveDrag =
  | Readonly<{
      source: "palette";
      block: BuilderBlock;
      pointerId: number;
      clientX: number;
      clientY: number;
    }>
  | Readonly<{
      source: "document";
      block: BuilderBlock;
      pointerId: number;
      clientX: number;
      clientY: number;
      copy: boolean;
    }>;

interface PendingDetach {
  readonly block: BuilderBlock;
  readonly clientX: number;
  readonly clientY: number;
}

function viewportFromAppState(appState: AppState): CanvasViewport {
  return {
    zoom: appState.zoom,
    offsetLeft: appState.offsetLeft,
    offsetTop: appState.offsetTop,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
  };
}

function sameViewport(left: CanvasViewport | null, right: CanvasViewport): boolean {
  return (
    left !== null &&
    left.zoom.value === right.zoom.value &&
    left.offsetLeft === right.offsetLeft &&
    left.offsetTop === right.offsetTop &&
    left.scrollX === right.scrollX &&
    left.scrollY === right.scrollY
  );
}

function blocksForDrag(
  blocks: readonly BuilderBlock[],
  drag: ActiveDrag,
): readonly BuilderBlock[] {
  if (drag.source === "palette" || drag.copy) {
    return blocks;
  }
  return blocks.filter((block) => block.id !== drag.block.id);
}

function readDetachPreference(): boolean {
  try {
    return globalThis.localStorage.getItem(detachWithoutAskingPreference) === "true";
  } catch {
    return false;
  }
}

function saveDetachPreference(): void {
  try {
    globalThis.localStorage.setItem(detachWithoutAskingPreference, "true");
  } catch {
    // Storage is an optional convenience; confirmation still works without it.
  }
}

export function DocumentBuilder({ port, registry, transport }: DocumentBuilderProps) {
  const subscribe = useCallback((listener: () => void) => port.subscribe(listener), [port]);
  const getSnapshot = useCallback(() => port.getSnapshot(), [port]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [canvasApi, setCanvasApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [pendingDetach, setPendingDetach] = useState<PendingDetach | null>(null);
  const [editingBlock, setEditingBlock] = useState<BuilderBlock | null>(null);
  const [transportError, setTransportError] = useState<string | null>(null);

  const dragRef = useRef<ActiveDrag | null>(null);

  const publishViewport = useCallback((appState: AppState) => {
    const nextViewport = viewportFromAppState(appState);
    setViewport((currentViewport) =>
      sameViewport(currentViewport, nextViewport) ? currentViewport : nextViewport,
    );
  }, []);

  const installCanvasApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      setCanvasApi(api);
      publishViewport(api.getAppState());
    },
    [publishViewport],
  );

  useEffect(() => {
    if (canvasApi === null) {
      return;
    }

    let positionFrame: number | null = null;
    const openFrame = requestAnimationFrame(() => {
      canvasApi.toggleSidebar({ name: blocksSidebarName, force: true });
      positionFrame = requestAnimationFrame(() => {
        canvasApi.scrollToContent(pageAnchorId, {
          fitToViewport: true,
          viewportZoomFactor: 0.64,
          animate: false,
        });
      });
    });

    return () => {
      cancelAnimationFrame(openFrame);
      if (positionFrame !== null) {
        cancelAnimationFrame(positionFrame);
      }
    };
  }, [canvasApi]);

  const setCurrentPlacement = useCallback((nextPlacement: Placement | null) => {
    setPlacement((currentPlacement) => {
      if (currentPlacement?.index === nextPlacement?.index) {
        return currentPlacement;
      }
      return nextPlacement;
    });
  }, []);

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    setActiveDrag(null);
    setPlacement(null);
  }, []);

  const resolvePlacement = useCallback(
    (clientX: number, clientY: number, drag: ActiveDrag): Placement | null => {
      if (canvasApi === null) {
        return null;
      }

      const appState = canvasApi.getAppState();
      const scenePoint = viewportCoordsToSceneCoords({ clientX, clientY }, appState);
      const flowBlocks = blocksForDrag(snapshot.blocks, drag);
      const baseLayout = computeDocumentLayout(flowBlocks, registry);
      if (!isInsideDocumentColumn(scenePoint.x, scenePoint.y, baseLayout)) {
        return null;
      }
      return { index: insertionIndexAtSceneY(scenePoint.y, baseLayout) };
    },
    [canvasApi, registry, snapshot.blocks],
  );

  const updateDocumentCopyMode = useCallback(
    (copy: boolean) => {
      const drag = dragRef.current;
      if (drag?.source !== "document" || drag.copy === copy) {
        return;
      }
      const updatedDrag = { ...drag, copy };
      dragRef.current = updatedDrag;
      setActiveDrag(updatedDrag);
      setCurrentPlacement(resolvePlacement(updatedDrag.clientX, updatedDrag.clientY, updatedDrag));
    },
    [resolvePlacement, setCurrentPlacement],
  );

  const isDragging = activeDrag !== null;
  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (drag?.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const movedDrag: ActiveDrag =
        drag.source === "document"
          ? {
              ...drag,
              clientX: event.clientX,
              clientY: event.clientY,
              copy: event.altKey,
            }
          : { ...drag, clientX: event.clientX, clientY: event.clientY };
      dragRef.current = movedDrag;
      setActiveDrag(movedDrag);
      setCurrentPlacement(resolvePlacement(event.clientX, event.clientY, movedDrag));
    };

    const handlePointerUp = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (drag?.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const completedDrag: ActiveDrag =
        drag.source === "document" ? { ...drag, copy: event.altKey } : drag;
      const finalPlacement = resolvePlacement(event.clientX, event.clientY, completedDrag);
      if (finalPlacement !== null) {
        clearDrag();
        if (completedDrag.source === "palette") {
          port.dispatch({
            kind: "insert",
            index: finalPlacement.index,
            block: completedDrag.block,
          });
          return;
        }
        if (completedDrag.copy) {
          port.dispatch({
            kind: "insert",
            index: finalPlacement.index,
            block: cloneBuilderBlock(completedDrag.block, createBlockId()),
          });
          return;
        }
        port.dispatch({
          kind: "move",
          blockId: completedDrag.block.id,
          index: finalPlacement.index,
        });
        return;
      }

      if (completedDrag.source === "document" && !completedDrag.copy) {
        if (readDetachPreference()) {
          clearDrag();
          port.dispatch({ kind: "delete", blockId: completedDrag.block.id });
          return;
        }
        const detached = {
          block: completedDrag.block,
          clientX: event.clientX,
          clientY: event.clientY,
        } satisfies PendingDetach;
        dragRef.current = null;
        setActiveDrag(null);
        setPlacement(null);
        setPendingDetach(detached);
        return;
      }
      clearDrag();
    };

    const handlePointerCancel = (event: PointerEvent): void => {
      if (dragRef.current?.pointerId === event.pointerId) {
        clearDrag();
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        clearDrag();
        return;
      }
      if (event.key === "Alt") {
        updateDocumentCopyMode(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.key === "Alt") {
        updateDocumentCopyMode(false);
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: false });
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [clearDrag, isDragging, port, resolvePlacement, setCurrentPlacement, updateDocumentCopyMode]);

  const beginDrag = useCallback(
    (drag: ActiveDrag, initialPlacement: Placement | null) => {
      dragRef.current = drag;
      setActiveDrag(drag);
      setPlacement(initialPlacement);
    },
    [],
  );

  const beginPaletteDrag = useCallback(
    (plugin: BuilderBlockPlugin, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      beginDrag(
        {
          source: "palette",
          block: plugin.createDefault(createBlockId()),
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
        },
        null,
      );
    },
    [beginDrag],
  );

  const beginDocumentDrag = useCallback(
    (
      block: BuilderBlock,
      index: number,
      event: ReactPointerEvent<HTMLButtonElement>,
    ) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      beginDrag(
        {
          source: "document",
          block,
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          copy: event.altKey,
        },
        { index },
      );
    },
    [beginDrag],
  );

  const flowBlocks = useMemo(() => {
    if (activeDrag !== null) {
      return blocksForDrag(snapshot.blocks, activeDrag);
    }
    if (pendingDetach !== null) {
      return snapshot.blocks.filter((block) => block.id !== pendingDetach.block.id);
    }
    return snapshot.blocks;
  }, [activeDrag, pendingDetach, snapshot.blocks]);

  const insertionPreview = useMemo<InsertionPreview | null>(
    () =>
      activeDrag === null || placement === null
        ? null
        : { index: placement.index, block: activeDrag.block },
    [activeDrag, placement],
  );
  const layout = useMemo(
    () => computeDocumentLayout(flowBlocks, registry, insertionPreview),
    [flowBlocks, insertionPreview, registry],
  );

  useEffect(() => {
    if (canvasApi === null) {
      return;
    }
    const sceneElements = canvasApi.getSceneElements();
    const currentPageAnchor = sceneElements.find((element) => element.id === pageAnchorId);
    if (
      currentPageAnchor === undefined ||
      currentPageAnchor.height === layout.pageBounds.height
    ) {
      return;
    }

    const resizedPageAnchor = newElementWith(currentPageAnchor, {
      height: layout.pageBounds.height,
    });
    canvasApi.updateScene({
      elements: sceneElements.map((element) =>
        element.id === pageAnchorId ? resizedPageAnchor : element,
      ),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [canvasApi, layout.pageBounds.height]);

  const pageStyle = useMemo<CSSProperties | undefined>(() => {
    if (viewport === null) {
      return undefined;
    }
    const pageOrigin = sceneCoordsToViewportCoords(
      { sceneX: layout.pageBounds.x, sceneY: layout.pageBounds.y },
      viewport,
    );
    return {
      width: layout.pageBounds.width,
      height: layout.pageBounds.height,
      transform: `translate3d(${String(pageOrigin.x)}px, ${String(pageOrigin.y)}px, 0) scale(${String(viewport.zoom.value)})`,
    };
  }, [layout.pageBounds, viewport]);

  const deleteBlock = useCallback(
    (blockId: string) => {
      port.dispatch({ kind: "delete", blockId });
    },
    [port],
  );

  const beginEdit = useCallback(
    (block: BuilderBlock) => {
      if (registry.editorForBlock(block) === null) {
        console.info("Trying to Edit", { blockId: block.id, typeId: block.typeId });
        return;
      }
      setEditingBlock(block);
    },
    [registry],
  );

  const editingDescriptor =
    editingBlock === null ? null : registry.editorForBlock(editingBlock);

  const saveDocument = useCallback((): void => {
    try {
      const source = transport.toString(port.getSnapshot());
      const url = URL.createObjectURL(
        new Blob([source], { type: "application/json;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "document.dans.json";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      globalThis.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);
      setTransportError(null);
    } catch (error) {
      setTransportError(error instanceof Error ? error.message : "Could not save document");
    }
  }, [port, transport]);

  const loadDocument = useCallback(
    async (file: File): Promise<void> => {
      try {
        const decoded = transport.fromString(await file.text());
        clearDrag();
        setPendingDetach(null);
        setEditingBlock(null);
        port.dispatch({ kind: "replace_all", ...decoded });
        setTransportError(null);
      } catch (error) {
        setTransportError(error instanceof Error ? error.message : "Could not load document");
      }
    },
    [clearDrag, port, transport],
  );

  return (
    <main className="builder-shell">
      <section className="canvas-host" aria-label="Excalidraw notes canvas and document builder">
        <div className="document-visual-layer" aria-hidden={pageStyle === undefined}>
          {pageStyle === undefined ? null : (
            <DocumentVisualPage layout={layout} pageStyle={pageStyle} registry={registry} />
          )}
        </div>

        <Excalidraw
          name="Dan's document workspace"
          initialData={{
            elements: [pageAnchor],
            appState: {
              viewBackgroundColor: "transparent",
              openSidebar: { name: blocksSidebarName },
              defaultSidebarDockedPreference: true,
            },
          }}
          excalidrawAPI={installCanvasApi}
          onChange={(_elements, appState) => {
            publishViewport(appState);
          }}
          UIOptions={{ dockedSidebarBreakpoint: 0 }}
        >
          <BlockPalette
            sidebarName={blocksSidebarName}
            blockCount={snapshot.blocks.length}
            registry={registry}
            transportError={transportError}
            onSaveDocument={saveDocument}
            onLoadDocument={loadDocument}
            onBeginDrag={beginPaletteDrag}
          />
          <Footer>
            <Sidebar.Trigger name={blocksSidebarName} title="Open document blocks">
              <span className="blocks-trigger">▦ Blocks</span>
            </Sidebar.Trigger>
          </Footer>
        </Excalidraw>

        <div className="document-control-layer" aria-hidden={pageStyle === undefined}>
          {pageStyle === undefined ? null : (
            <DocumentControls
              layout={layout}
              pageStyle={pageStyle}
              registry={registry}
              onBeginMove={beginDocumentDrag}
              onDelete={deleteBlock}
              onEdit={beginEdit}
            />
          )}
        </div>

        {activeDrag === null ? null : (
          <DragGhost
            clientX={activeDrag.clientX}
            clientY={activeDrag.clientY}
            insertionIndex={placement?.index ?? null}
            mode={
              activeDrag.source === "palette" ? "insert" : activeDrag.copy ? "copy" : "move"
            }
            plugin={registry.pluginForBlock(activeDrag.block)}
          />
        )}

        {pendingDetach === null ? null : (
          <>
            <DragGhost
              clientX={pendingDetach.clientX}
              clientY={pendingDetach.clientY}
              insertionIndex={null}
              mode="detached"
              plugin={registry.pluginForBlock(pendingDetach.block)}
            />
            <DetachConfirmation
              block={pendingDetach.block}
              onCancel={() => {
                setPendingDetach(null);
              }}
              onDelete={(doNotAskAgain) => {
                if (doNotAskAgain) {
                  saveDetachPreference();
                }
                port.dispatch({ kind: "delete", blockId: pendingDetach.block.id });
                setPendingDetach(null);
              }}
            />
          </>
        )}

        {editingBlock === null || editingDescriptor === null ? null : (
          <EditorDialog
            title={editingDescriptor.title(editingBlock)}
            onClose={() => {
              setEditingBlock(null);
            }}
          >
            {editingDescriptor.render({
              block: editingBlock,
              onCancel: () => {
                setEditingBlock(null);
              },
              onCommit: (replacement) => {
                port.dispatch({
                  kind: "replace",
                  blockId: editingBlock.id,
                  block: replacement,
                });
                setEditingBlock(null);
              },
            })}
          </EditorDialog>
        )}
      </section>
    </main>
  );
}
