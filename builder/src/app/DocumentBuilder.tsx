// builder/src/app/DocumentBuilder.tsx — host a growing document beneath an Excalidraw canvas.
import {
  CaptureUpdateAction,
  Excalidraw,
  Footer,
  Sidebar,
  newElementWith,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
  zoomToFitBounds,
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
  insertionTargetAtScenePoint,
  isInsideDocumentColumn,
  type DocumentLayoutMode,
  type InsertionPreview,
  type PageRange,
} from "../builder/layout";
import type { BuilderBlockPlugin, BuilderPluginRegistry } from "../builder/plugin";
import { copyBuilderBlockForInsert } from "../builder/copyBlock";
import { deriveReferenceTargets } from "../builder/referenceTargets";
import { deriveDocumentResources } from "../builder/documentResources";
import { deriveBlockOrdinals, deriveInlineOrdinals } from "../builder/numbering";
import { createPageAnchor, pageAnchorId } from "../canvas/pageAnchor";
import {
  createBlockId,
  flattenBuilderBlocks,
  removeBuilderBlockFromTree,
  replaceBuilderBlockInTree,
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
  readonly parentId: string | null;
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
  return removeBuilderBlockFromTree(blocks, drag.block.id);
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
  const [editingDraft, setEditingDraft] = useState<BuilderBlock | null>(null);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<DocumentLayoutMode>("continuous");
  const [pageRange, setPageRange] = useState<PageRange>({ start: 1, end: 3 });

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
      if (
        currentPlacement?.index === nextPlacement?.index &&
        currentPlacement?.parentId === nextPlacement?.parentId
      ) {
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
      const baseLayout = computeDocumentLayout(flowBlocks, registry, null, {
        mode: layoutMode,
        pageRange,
      });
      if (!isInsideDocumentColumn(scenePoint.x, scenePoint.y, baseLayout)) {
        return null;
      }
      return insertionTargetAtScenePoint(scenePoint.x, scenePoint.y, baseLayout);
    },
    [canvasApi, layoutMode, pageRange, registry, snapshot.blocks],
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
            parentId: finalPlacement.parentId,
            index: finalPlacement.index,
            block: completedDrag.block,
          });
          return;
        }
        if (completedDrag.copy) {
          port.dispatch({
            kind: "insert",
            parentId: finalPlacement.parentId,
            index: finalPlacement.index,
            block: copyBuilderBlockForInsert(completedDrag.block, registry),
          });
          return;
        }
        port.dispatch({
          kind: "move",
          blockId: completedDrag.block.id,
          parentId: finalPlacement.parentId,
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
  }, [
    clearDrag,
    isDragging,
    port,
    registry,
    resolvePlacement,
    setCurrentPlacement,
    updateDocumentCopyMode,
  ]);

  const beginDrag = useCallback(
    (drag: ActiveDrag, initialPlacement: Placement | null) => {
      setEditingBlock(null);
      setEditingDraft(null);
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
      parentId: string | null,
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
        { parentId, index },
      );
    },
    [beginDrag],
  );

  const flowBlocks = useMemo(() => {
    if (activeDrag !== null) {
      return blocksForDrag(snapshot.blocks, activeDrag);
    }
    if (pendingDetach !== null) {
      return removeBuilderBlockFromTree(snapshot.blocks, pendingDetach.block.id);
    }
    if (editingBlock !== null && editingDraft !== null) {
      return replaceBuilderBlockInTree(snapshot.blocks, editingBlock.id, editingDraft);
    }
    return snapshot.blocks;
  }, [activeDrag, editingBlock, editingDraft, pendingDetach, snapshot.blocks]);

  const insertionPreview = useMemo<InsertionPreview | null>(
    () =>
      activeDrag === null || placement === null
        ? null
        : {
            parentId: placement.parentId,
            index: placement.index,
            block: activeDrag.block,
          },
    [activeDrag, placement],
  );
  const layout = useMemo(
    () =>
      computeDocumentLayout(flowBlocks, registry, insertionPreview, {
        mode: layoutMode,
        pageRange,
      }),
    [flowBlocks, insertionPreview, layoutMode, pageRange, registry],
  );
  const referenceTargets = useMemo(
    () => deriveReferenceTargets(flowBlocks, registry),
    [flowBlocks, registry],
  );
  const inlineOrdinals = useMemo(
    () => deriveInlineOrdinals(flowBlocks, registry),
    [flowBlocks, registry],
  );
  const documentResources = useMemo(
    () => deriveDocumentResources(flowBlocks, registry),
    [flowBlocks, registry],
  );
  const blockOrdinals = useMemo(
    () =>
      deriveBlockOrdinals(flattenBuilderBlocks(flowBlocks), (block) =>
        registry.pluginForBlock(block).numberingSeries ?? null,
      ),
    [flowBlocks, registry],
  );

  useEffect(() => {
    if (canvasApi === null) {
      return;
    }
    const sceneElements = canvasApi.getSceneElements();
    const currentPageAnchor = sceneElements.find((element) => element.id === pageAnchorId);
    if (
      currentPageAnchor === undefined ||
      currentPageAnchor.x === layout.pageBounds.x &&
      currentPageAnchor.y === layout.pageBounds.y &&
      currentPageAnchor.width === layout.pageBounds.width &&
      currentPageAnchor.height === layout.pageBounds.height
    ) {
      return;
    }

    const horizontalBoundsChanged =
      currentPageAnchor.x !== layout.pageBounds.x ||
      currentPageAnchor.width !== layout.pageBounds.width;
    const resizedPageAnchor = newElementWith(currentPageAnchor, {
      x: layout.pageBounds.x,
      y: layout.pageBounds.y,
      width: layout.pageBounds.width,
      height: layout.pageBounds.height,
    });
    canvasApi.updateScene({
      elements: sceneElements.map((element) =>
        element.id === pageAnchorId ? resizedPageAnchor : element,
      ),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    if (!horizontalBoundsChanged) {
      return;
    }
    const reframe = requestAnimationFrame(() => {
      canvasApi.scrollToContent(pageAnchorId, {
        fitToViewport: true,
        viewportZoomFactor: 0.86,
        animate: true,
      });
    });
    return () => {
      cancelAnimationFrame(reframe);
    };
  }, [canvasApi, layout.pageBounds]);

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
      if (editingBlock?.id === blockId) {
        setEditingBlock(null);
        setEditingDraft(null);
      }
      port.dispatch({ kind: "delete", blockId });
    },
    [editingBlock, port],
  );

  const beginEdit = useCallback(
    (block: BuilderBlock) => {
      if (registry.editorForBlock(block) === null) {
        console.info("Trying to Edit", { blockId: block.id, typeId: block.typeId });
        return;
      }
      setEditingBlock(block);
      setEditingDraft(block);
      const blockLayout = layout.blocks.find(({ block: candidate }) => candidate.id === block.id);
      if (canvasApi !== null && blockLayout !== undefined) {
        const { x, y, width, height } = blockLayout.bounds;
        const fitted = zoomToFitBounds({
          bounds: [x, y, x + width, y + height],
          appState: canvasApi.getAppState(),
          canvasOffsets: { top: 70, right: 340, bottom: 70, left: 50 },
          fitToViewport: true,
          viewportZoomFactor: 0.82,
          minZoom: 0.45,
          maxZoom: 1,
        });
        canvasApi.updateScene({
          appState: {
            scrollX: fitted.appState.scrollX,
            scrollY: fitted.appState.scrollY,
            zoom: fitted.appState.zoom,
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }
    },
    [canvasApi, layout.blocks, registry],
  );

  const editingDescriptor =
    editingBlock === null ? null : registry.editorForBlock(editingBlock);
  const closeEditor = useCallback(() => {
    setEditingBlock(null);
    setEditingDraft(null);
  }, []);
  const previewEditorBlock = useCallback(
    (replacement: BuilderBlock) => {
      if (
        replacement.id !== editingBlock?.id ||
        replacement.typeId !== editingBlock.typeId
      ) {
        throw new Error("An editor preview must preserve its block ID and semantic type");
      }
      setEditingDraft(replacement);
    },
    [editingBlock],
  );
  const commitEditorBlock = useCallback(
    (replacement: BuilderBlock) => {
      if (editingBlock === null) {
        throw new Error("Cannot commit a block after its editor was closed");
      }
      port.dispatch({ kind: "replace", blockId: editingBlock.id, block: replacement });
      closeEditor();
    },
    [closeEditor, editingBlock, port],
  );
  const editorProps =
    editingBlock === null || editingDraft === null
      ? null
      : {
          block: editingDraft,
          numberingSeries:
            registry.pluginForBlock(editingDraft).numberingSeries ?? null,
          ordinal: blockOrdinals.get(editingDraft.id)?.ordinal ?? null,
          onPreview: previewEditorBlock,
          onCancel: closeEditor,
          onCommit: commitEditorBlock,
          referenceTargets,
          inlineOrdinals,
          documentResources,
        };
  const inlineEditor =
    editingDescriptor?.presentation === "inline" && editorProps !== null
      ? {
          blockId: editorProps.block.id,
          title: editingDescriptor.title(editorProps.block),
          content: editingDescriptor.render(editorProps),
        }
      : null;

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
        deriveReferenceTargets(decoded.blocks, registry);
        deriveDocumentResources(decoded.blocks, registry);
        clearDrag();
        setPendingDetach(null);
        setEditingBlock(null);
        setEditingDraft(null);
        port.dispatch({ kind: "replace_all", ...decoded });
        setTransportError(null);
      } catch (error) {
        setTransportError(error instanceof Error ? error.message : "Could not load document");
      }
    },
    [clearDrag, port, registry, transport],
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
            semanticBlockCount={flattenBuilderBlocks(snapshot.blocks).length}
            registry={registry}
            layoutMode={layoutMode}
            pageRange={layout.visiblePageRange}
            totalPageCount={layout.totalPageCount}
            transportError={transportError}
            onSaveDocument={saveDocument}
            onLoadDocument={loadDocument}
            onLayoutModeChange={setLayoutMode}
            onPageRangeChange={setPageRange}
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
              inlineEditor={inlineEditor}
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

        {editingDescriptor === null ||
        editingDescriptor.presentation === "inline" ||
        editorProps === null ? null : (
          <EditorDialog
            title={editingDescriptor.title(editorProps.block)}
            onClose={closeEditor}
          >
            {editingDescriptor.render(editorProps)}
          </EditorDialog>
        )}
      </section>
    </main>
  );
}
