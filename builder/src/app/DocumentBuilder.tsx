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
  type KeyboardEvent as ReactKeyboardEvent,
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
import type {
  BuilderBlockContextEditorAction,
  BuilderBlockPlugin,
  BuilderPluginRegistry,
} from "../builder/plugin";
import { copyBuilderBlockForInsert } from "../builder/copyBlock";
import { deriveReferenceTargets } from "../builder/referenceTargets";
import { deriveDocumentResources } from "../builder/documentResources";
import {
  deriveInlineOrdinals,
  deriveNumberedBlockOrdinals,
} from "../builder/numbering";
import { createPageAnchor, pageAnchorId } from "../canvas/pageAnchor";
import {
  viewportAfterMiddleDrag,
  viewportAfterWheel,
  type CanvasViewportUpdate,
} from "../canvas/viewportGestures";
import {
  childBlockSequences,
  createBlockId,
  findBuilderBlock,
  flattenBuilderBlocks,
  isSectionBlock,
  removeBuilderBlockFromTree,
  replaceBuilderBlockInTree,
  type BuilderBlock,
  type BuilderBlockLocation,
  type DocumentCommand,
  type DocumentPort,
} from "../model/document";
import type { CanonicalDocumentTransport } from "../transport/documentTransport";
import { BlockPalette } from "./BlockPalette";
import {
  BlockRadialMenu,
  type BlockRadialAction,
} from "./BlockRadialMenu";
import { adjacentBlockId, blockIdAfterDeletion } from "./blockNavigation";
import { rememberDeletedBlocks } from "./deletedBlockCache";
import { DetachConfirmation } from "./DetachConfirmation";
import { DocumentControls, DocumentVisualPage } from "./DocumentPage";
import { DragGhost } from "./DragGhost";
import { EditorDialog } from "./EditorDialog";
import { NvimBlockEditor } from "./NvimBlockEditor";
import { PresentationView } from "./PresentationView";

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
  readonly parentSequenceId: string | null;
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
      blocks: readonly BuilderBlock[];
      pointerId: number;
      clientX: number;
      clientY: number;
      copy: boolean;
    }>;

interface PendingBlockDrag {
  readonly block: BuilderBlock;
  readonly blocks: readonly BuilderBlock[];
  readonly parentId: string | null;
  readonly parentSequenceId: string | null;
  readonly index: number;
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly draggable: boolean;
}

interface PendingDetach {
  readonly block: BuilderBlock;
  readonly clientX: number;
  readonly clientY: number;
}

interface BlockContextMenuState {
  readonly blockId: string;
  readonly clientX: number;
  readonly clientY: number;
}

interface MiddlePanGesture {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly viewport: CanvasViewportUpdate;
}

type EditorPresentation =
  | "dialog"
  | "inline"
  | "nvim"
  | "nvim_inline"
  | "nvim_preload";

type InsertCommand = Extract<DocumentCommand, Readonly<{ kind: "insert" }>>;
type MoveCommand = Extract<
  DocumentCommand,
  Readonly<{ kind: "move" | "move_many" }>
>;

interface StructuralUndoEntry {
  readonly undo: () => readonly string[];
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
  return drag.blocks.reduce(
    (remaining, block) => removeBuilderBlockFromTree(remaining, block.id),
    blocks,
  );
}

function siblingBlocks(
  blocks: readonly BuilderBlock[],
  parentId: string | null,
  parentSequenceId: string | null,
): readonly BuilderBlock[] {
  if (parentId === null) {
    return blocks;
  }
  const parent = findBuilderBlock(blocks, parentId)?.block;
  if (parent === undefined) {
    return [];
  }
  const sequences = childBlockSequences(parent);
  if (parentSequenceId === null) {
    return sequences.length === 1 ? sequences[0]?.blocks ?? [] : [];
  }
  return sequences.find(({ id }) => id === parentSequenceId)?.blocks ?? [];
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
  const [initialHotBlock] = useState<BuilderBlock | null>(() =>
    flattenBuilderBlocks(snapshot.blocks).find(
      (block) => registry.editorForBlock(block)?.sourceEditor?.preloadOnSelection === true,
    ) ?? null,
  );
  const [canvasApi, setCanvasApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [pendingBlockDrag, setPendingBlockDrag] = useState<PendingBlockDrag | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<readonly string[]>([]);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [pendingDetach, setPendingDetach] = useState<PendingDetach | null>(null);
  const [editingBlock, setEditingBlock] = useState<BuilderBlock | null>(initialHotBlock);
  const [editingDraft, setEditingDraft] = useState<BuilderBlock | null>(initialHotBlock);
  const [editingPresentation, setEditingPresentation] = useState<EditorPresentation | null>(
    initialHotBlock === null ? null : "nvim_preload",
  );
  const [editingContextActionId, setEditingContextActionId] = useState<string | null>(null);
  const [preloadSuppressedBlockId, setPreloadSuppressedBlockId] = useState<string | null>(null);
  const [blockContextMenu, setBlockContextMenu] = useState<BlockContextMenuState | null>(null);
  const [recentlyDeletedBlocks, setRecentlyDeletedBlocks] = useState<
    readonly BuilderBlock[]
  >([]);
  const [middlePanning, setMiddlePanning] = useState(false);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<DocumentLayoutMode>("continuous");
  const [pageRange, setPageRange] = useState<PageRange>({ start: 1, end: 3 });
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [presentationSlide, setPresentationSlide] = useState(1);

  const dragRef = useRef<ActiveDrag | null>(null);
  const pendingBlockDragRef = useRef<PendingBlockDrag | null>(null);
  const selectedBlockIdsRef = useRef<readonly string[]>([]);
  const selectionAnchorRef = useRef<string | null>(null);
  const middlePanRef = useRef<MiddlePanGesture | null>(null);
  const documentControlLayerRef = useRef<HTMLDivElement>(null);
  const nvimInlineHostRef = useRef<HTMLDivElement>(null);
  const undoStackRef = useRef<StructuralUndoEntry[]>([]);

  const activateEditor = useCallback(
    (
      block: BuilderBlock,
      presentation: EditorPresentation,
      contextActionId: string | null = null,
    ): void => {
      setEditingBlock(block);
      setEditingDraft(block);
      setEditingPresentation(presentation);
      setEditingContextActionId(contextActionId);
    },
    [],
  );

  const clearEditorState = useCallback((): void => {
    setEditingBlock(null);
    setEditingDraft(null);
    setEditingPresentation(null);
    setEditingContextActionId(null);
  }, []);

  const prepareSelectionEditor = useCallback(
    (blockId: string | null): void => {
      if (
        preloadSuppressedBlockId !== null &&
        preloadSuppressedBlockId !== blockId
      ) {
        setPreloadSuppressedBlockId(null);
      }
      if (blockId === null) {
        return;
      }

      const block = findBuilderBlock(port.getSnapshot().blocks, blockId)?.block ?? null;
      const sourceEditor = block === null
        ? undefined
        : registry.editorForBlock(block)?.sourceEditor;
      const shouldPreload =
        block !== null &&
        sourceEditor?.preloadOnSelection === true &&
        preloadSuppressedBlockId !== blockId;

      if (editingBlock?.id === blockId) {
        if (!shouldPreload && editingPresentation === "nvim_preload") {
          clearEditorState();
        }
        return;
      }
      if (shouldPreload) {
        if (editingPresentation !== null) {
          clearEditorState();
        }
        activateEditor(block, "nvim_preload");
      } else if (
        editingPresentation !== null &&
        editingPresentation !== "nvim_preload"
      ) {
        clearEditorState();
      }
    },
    [
      activateEditor,
      clearEditorState,
      editingBlock,
      editingPresentation,
      port,
      preloadSuppressedBlockId,
      registry,
    ],
  );

  const focusBlockControl = useCallback((blockId: string): void => {
    requestAnimationFrame(() => {
      const control = [...document.querySelectorAll<HTMLElement>("[data-block-id]")]
        .find((candidate) => candidate.dataset.blockId === blockId);
      control?.focus({ preventScroll: true });
    });
  }, []);

  const selectSingleBlock = useCallback(
    (blockId: string, focus = true): void => {
      const next = Object.freeze([blockId]);
      selectedBlockIdsRef.current = next;
      selectionAnchorRef.current = blockId;
      setSelectedBlockIds(next);
      prepareSelectionEditor(blockId);
      if (focus) {
        focusBlockControl(blockId);
      }
    },
    [focusBlockControl, prepareSelectionEditor],
  );

  const clearBlockSelection = useCallback((): void => {
    selectedBlockIdsRef.current = Object.freeze([]);
    selectionAnchorRef.current = null;
    setSelectedBlockIds(selectedBlockIdsRef.current);
    setBlockContextMenu(null);
    if (editingPresentation !== null && editingPresentation !== "nvim_preload") {
      setPreloadSuppressedBlockId(editingBlock?.id ?? null);
      clearEditorState();
    }
  }, [clearEditorState, editingBlock, editingPresentation]);

  const insertBlocksWithUndo = useCallback(
    (commands: readonly InsertCommand[]): void => {
      const beforeRevision = port.getSnapshot().revision;
      commands.forEach((command) => {
        port.dispatch(command);
      });
      if (port.getSnapshot().revision === beforeRevision) {
        return;
      }
      const insertedIds = commands.map(({ block }) => block.id);
      undoStackRef.current.push({
        undo: () => {
          const orderedIds = flattenBuilderBlocks(port.getSnapshot().blocks).map(({ id }) => id);
          const nextBlockId = blockIdAfterDeletion(orderedIds, insertedIds);
          insertedIds.forEach((blockId) => {
            if (findBuilderBlock(port.getSnapshot().blocks, blockId) !== null) {
              port.dispatch({ kind: "delete", blockId });
            }
          });
          return nextBlockId === null ? [] : [nextBlockId];
        },
      });
    },
    [port],
  );

  const moveBlocksWithUndo = useCallback(
    (command: MoveCommand, blockIds: readonly string[]): void => {
      const locations = blockIds
        .map((blockId) => findBuilderBlock(port.getSnapshot().blocks, blockId))
        .filter((location): location is BuilderBlockLocation => location !== null)
        .sort((left, right) => left.index - right.index);
      const first = locations[0];
      if (first === undefined || locations.length !== blockIds.length) {
        return;
      }
      const beforeRevision = port.getSnapshot().revision;
      port.dispatch(command);
      if (port.getSnapshot().revision === beforeRevision) {
        return;
      }
      const orderedIds = locations.map(({ block }) => block.id);
      undoStackRef.current.push({
        undo: () => {
          if (orderedIds.length === 1) {
            const blockId = orderedIds[0];
            if (blockId !== undefined) {
              port.dispatch({
                kind: "move",
                blockId,
                parentId: first.parentId,
                parentSequenceId: first.parentSequenceId,
                index: first.index,
              });
            }
          } else {
            port.dispatch({
              kind: "move_many",
              blockIds: orderedIds,
              parentId: first.parentId,
              parentSequenceId: first.parentSequenceId,
              index: first.index,
            });
          }
          return orderedIds;
        },
      });
    },
    [port],
  );

  const deleteBlocks = useCallback((blockIds: readonly string[]): void => {
    if (blockIds.length === 0) {
      return;
    }
    const orderedBlockIds = flattenBuilderBlocks(snapshot.blocks).map(({ id }) => id);
    const nextBlockId = blockIdAfterDeletion(orderedBlockIds, blockIds);
    const deletedLocations = blockIds
      .map((blockId) => findBuilderBlock(snapshot.blocks, blockId))
      .filter((location): location is BuilderBlockLocation => location !== null)
      .sort((left, right) => left.index - right.index);
    if (editingBlock !== null && blockIds.includes(editingBlock.id)) {
      clearEditorState();
    }
    setBlockContextMenu(null);
    const beforeRevision = port.getSnapshot().revision;
    blockIds.forEach((blockId) => {
      port.dispatch({ kind: "delete", blockId });
    });
    if (port.getSnapshot().revision !== beforeRevision && deletedLocations.length > 0) {
      const deletedBlocks = deletedLocations.map(({ block }) => block);
      setRecentlyDeletedBlocks((current) =>
        rememberDeletedBlocks(current, deletedBlocks),
      );
      undoStackRef.current.push({
        undo: () => {
          deletedLocations.forEach((location) => {
            port.dispatch({
              kind: "insert",
              parentId: location.parentId,
              parentSequenceId: location.parentSequenceId,
              index: location.index,
              block: location.block,
            });
          });
          return deletedLocations.map(({ block }) => block.id);
        },
      });
    }
    if (nextBlockId === null) {
      selectedBlockIdsRef.current = Object.freeze([]);
      selectionAnchorRef.current = null;
      setSelectedBlockIds(selectedBlockIdsRef.current);
    } else {
      selectSingleBlock(nextBlockId);
    }
  }, [clearEditorState, editingBlock, port, selectSingleBlock, snapshot.blocks]);

  useEffect(() => {
    const handleUndo = (event: KeyboardEvent): void => {
      if (
        event.key.toLowerCase() !== "z" ||
        (!event.ctrlKey && !event.metaKey) ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, [contenteditable='true'], .editor-dialog, .nvim-editor-host") !== null
      ) {
        return;
      }
      const entry = undoStackRef.current.pop();
      if (entry === undefined) {
        return;
      }
      event.preventDefault();
      setBlockContextMenu(null);
      clearEditorState();
      const restoredSelection = entry.undo();
      const firstSelection = restoredSelection[0];
      if (firstSelection === undefined) {
        selectedBlockIdsRef.current = Object.freeze([]);
        selectionAnchorRef.current = null;
        setSelectedBlockIds(selectedBlockIdsRef.current);
      } else {
        const retained = restoredSelection.filter(
          (blockId) => findBuilderBlock(port.getSnapshot().blocks, blockId) !== null,
        );
        selectedBlockIdsRef.current = Object.freeze(retained);
        selectionAnchorRef.current = firstSelection;
        setSelectedBlockIds(selectedBlockIdsRef.current);
        focusBlockControl(firstSelection);
      }
    };
    window.addEventListener("keydown", handleUndo);
    return () => {
      window.removeEventListener("keydown", handleUndo);
    };
  }, [clearEditorState, focusBlockControl, port]);

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

  const routeDocumentWheelToCanvas = useCallback(
    (event: WheelEvent): void => {
      if (canvasApi === null) {
        return;
      }
      const target = event.target;
      const insideEditor =
        target instanceof Element && target.closest(".inline-block-editor") !== null;
      if (insideEditor && !event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setBlockContextMenu(null);
      const nextViewport = viewportAfterWheel(canvasApi.getAppState(), {
        clientX: event.clientX,
        clientY: event.clientY,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      });
      canvasApi.updateScene({
        appState: nextViewport,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      publishViewport(canvasApi.getAppState());
    },
    [canvasApi, publishViewport],
  );

  useEffect(() => {
    const layer = documentControlLayerRef.current;
    if (layer === null) {
      return;
    }
    layer.addEventListener("wheel", routeDocumentWheelToCanvas, { passive: false });
    return () => {
      layer.removeEventListener("wheel", routeDocumentWheelToCanvas);
    };
  }, [routeDocumentWheelToCanvas]);

  const beginDocumentMiddlePan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (event.button !== 1 || canvasApi === null) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const appState = canvasApi.getAppState();
      middlePanRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        viewport: {
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom,
        },
      };
      setBlockContextMenu(null);
      setMiddlePanning(true);
    },
    [canvasApi],
  );

  useEffect(() => {
    if (canvasApi === null) {
      return;
    }
    const handlePointerMove = (event: PointerEvent): void => {
      const gesture = middlePanRef.current;
      if (gesture?.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      const nextViewport = viewportAfterMiddleDrag(
        gesture.viewport,
        event.clientX - gesture.clientX,
        event.clientY - gesture.clientY,
      );
      canvasApi.updateScene({
        appState: nextViewport,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      publishViewport(canvasApi.getAppState());
    };
    const finishPan = (event: PointerEvent): void => {
      if (middlePanRef.current?.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      middlePanRef.current = null;
      setMiddlePanning(false);
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", finishPan, { passive: false });
    window.addEventListener("pointercancel", finishPan);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPan);
      window.removeEventListener("pointercancel", finishPan);
    };
  }, [canvasApi, publishViewport]);

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
        currentPlacement?.parentId === nextPlacement?.parentId &&
        currentPlacement?.parentSequenceId === nextPlacement?.parentSequenceId
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
          insertBlocksWithUndo([
            {
              kind: "insert",
              parentId: finalPlacement.parentId,
              parentSequenceId: finalPlacement.parentSequenceId,
              index: finalPlacement.index,
              block: completedDrag.block,
            },
          ]);
          return;
        }
        if (completedDrag.copy) {
          insertBlocksWithUndo(
            completedDrag.blocks.map((block, offset) => ({
              kind: "insert",
              parentId: finalPlacement.parentId,
              parentSequenceId: finalPlacement.parentSequenceId,
              index: finalPlacement.index + offset,
              block: copyBuilderBlockForInsert(block, registry),
            })),
          );
          return;
        }
        if (completedDrag.blocks.length === 1) {
          moveBlocksWithUndo(
            {
              kind: "move",
              blockId: completedDrag.block.id,
              parentId: finalPlacement.parentId,
              parentSequenceId: finalPlacement.parentSequenceId,
              index: finalPlacement.index,
            },
            [completedDrag.block.id],
          );
        } else {
          const blockIds = completedDrag.blocks.map(({ id }) => id);
          moveBlocksWithUndo(
            {
              kind: "move_many",
              blockIds,
              parentId: finalPlacement.parentId,
              parentSequenceId: finalPlacement.parentSequenceId,
              index: finalPlacement.index,
            },
            blockIds,
          );
        }
        return;
      }

      if (completedDrag.source === "document" && !completedDrag.copy) {
        if (completedDrag.blocks.length > 1) {
          clearDrag();
          return;
        }
        if (readDetachPreference()) {
          clearDrag();
          deleteBlocks([completedDrag.block.id]);
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
    deleteBlocks,
    isDragging,
    insertBlocksWithUndo,
    moveBlocksWithUndo,
    port,
    registry,
    resolvePlacement,
    setCurrentPlacement,
    updateDocumentCopyMode,
  ]);

  const beginDrag = useCallback(
    (drag: ActiveDrag, initialPlacement: Placement | null) => {
      if (editingPresentation !== "nvim_preload") {
        clearEditorState();
      }
      setBlockContextMenu(null);
      dragRef.current = drag;
      setActiveDrag(drag);
      setPlacement(initialPlacement);
    },
    [clearEditorState, editingPresentation],
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

  const beginDocumentPointer = useCallback(
    (
      block: BuilderBlock,
      parentId: string | null,
      parentSequenceId: string | null,
      index: number,
      event: ReactPointerEvent<HTMLElement>,
    ) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setBlockContextMenu(null);
      event.currentTarget.focus();

      const siblings = siblingBlocks(snapshot.blocks, parentId, parentSequenceId);
      const current = selectedBlockIdsRef.current.filter((blockId) => {
        const location = findBuilderBlock(snapshot.blocks, blockId);
        return (
          location?.parentId === parentId &&
          location.parentSequenceId === parentSequenceId
        );
      });
      let next: readonly string[];
      if (event.shiftKey) {
        const anchorId = selectionAnchorRef.current;
        const anchorIndex = anchorId === null
          ? -1
          : siblings.findIndex(({ id }) => id === anchorId);
        if (anchorIndex < 0) {
          next = [block.id];
        } else {
          const start = Math.min(anchorIndex, index);
          const end = Math.max(anchorIndex, index);
          next = siblings.slice(start, end + 1).map(({ id }) => id);
        }
      } else if (event.ctrlKey || event.metaKey) {
        next = current.includes(block.id)
          ? current.filter((blockId) => blockId !== block.id)
          : [...current, block.id];
      } else {
        next = current.includes(block.id) ? current : [block.id];
      }
      if (!event.shiftKey) {
        selectionAnchorRef.current = next.includes(block.id) ? block.id : null;
      }
      selectedBlockIdsRef.current = Object.freeze([...next]);
      setSelectedBlockIds(selectedBlockIdsRef.current);
      prepareSelectionEditor(next.length === 1 ? next[0] ?? null : null);

      const selectedSet = new Set(next);
      const ordered = siblings.filter(({ id }) => selectedSet.has(id));
      const selectedIndices = ordered.map(({ id }) =>
        siblings.findIndex((candidate) => candidate.id === id),
      );
      const contiguous = selectedIndices.every(
        (selectedIndex, offset) =>
          selectedIndex === (selectedIndices[0] ?? selectedIndex) + offset,
      );
      const pending = {
        block: ordered[0] ?? block,
        blocks: Object.freeze(ordered),
        parentId,
        parentSequenceId,
        index: selectedIndices[0] ?? index,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        draggable: next.includes(block.id) && ordered.length > 0 && contiguous,
      } satisfies PendingBlockDrag;
      pendingBlockDragRef.current = pending;
      setPendingBlockDrag(pending);
    },
    [prepareSelectionEditor, snapshot.blocks],
  );

  useEffect(() => {
    if (pendingBlockDrag === null) {
      return;
    }
    const clearPending = (): void => {
      pendingBlockDragRef.current = null;
      setPendingBlockDrag(null);
    };
    const handlePointerMove = (event: PointerEvent): void => {
      const pending = pendingBlockDragRef.current;
      if (event.pointerId !== pending?.pointerId) {
        return;
      }
      const distance = Math.hypot(
        event.clientX - pending.clientX,
        event.clientY - pending.clientY,
      );
      if (distance < 5) {
        return;
      }
      clearPending();
      if (!pending.draggable) {
        return;
      }
      event.preventDefault();
      const drag = {
        source: "document",
        block: pending.block,
        blocks: pending.blocks,
        pointerId: pending.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        copy: event.altKey,
      } satisfies ActiveDrag;
      beginDrag(drag, {
        parentId: pending.parentId,
        parentSequenceId: pending.parentSequenceId,
        index: pending.index,
      });
      setCurrentPlacement(resolvePlacement(event.clientX, event.clientY, drag));
    };
    const handlePointerEnd = (event: PointerEvent): void => {
      if (event.pointerId === pendingBlockDragRef.current?.pointerId) {
        clearPending();
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        clearPending();
      }
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [beginDrag, pendingBlockDrag, resolvePlacement, setCurrentPlacement]);

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

  const dragDestination = useMemo(() => {
    if (placement === null) {
      return null;
    }
    if (placement.parentId === null) {
      return "Insert at root";
    }
    const parent = findBuilderBlock(snapshot.blocks, placement.parentId)?.block;
    if (parent === undefined) {
      return "Insert into nested block";
    }
    const label = registry.pluginForBlock(parent).palette.label;
    return isSectionBlock(parent)
      ? `Insert into ${label} “${parent.title}”`
      : `Insert into ${label}`;
  }, [placement, registry, snapshot.blocks]);

  const insertionPreview = useMemo<InsertionPreview | null>(
    () =>
      activeDrag === null || placement === null
        ? null
        : {
            parentId: placement.parentId,
            parentSequenceId: placement.parentSequenceId,
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
  const presentationLayout = useMemo(
    () =>
      computeDocumentLayout(snapshot.blocks, registry, null, {
        mode: "slides",
        pageRange: { start: presentationSlide, end: presentationSlide },
      }),
    [presentationSlide, registry, snapshot.blocks],
  );

  useEffect(() => {
    const handleFullscreenChange = (): void => {
      if (document.fullscreenElement === null) {
        setPresentationOpen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);
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
      deriveNumberedBlockOrdinals(flattenBuilderBlocks(flowBlocks), (block) =>
        registry.numberedOccurrencesForBlock(block),
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

  useEffect(() => {
    const existingIds = new Set(
      flattenBuilderBlocks(snapshot.blocks).map(({ id }) => id),
    );
    const retained = selectedBlockIdsRef.current.filter((id) => existingIds.has(id));
    if (retained.length !== selectedBlockIdsRef.current.length) {
      selectedBlockIdsRef.current = Object.freeze(retained);
      setSelectedBlockIds(selectedBlockIdsRef.current);
    }
  }, [snapshot.blocks]);

  const deleteSelectedBlocks = useCallback(() => {
    deleteBlocks(selectedBlockIdsRef.current);
  }, [deleteBlocks]);

  const beginEdit = useCallback(
    (block: BuilderBlock, requestedPresentation?: EditorPresentation) => {
      const descriptor = registry.editorForBlock(block);
      if (descriptor === null) {
        console.info("Trying to Edit", { blockId: block.id, typeId: block.typeId });
        return;
      }
      const sourceEditor = descriptor.sourceEditor;
      const defaultPresentation: EditorPresentation =
        sourceEditor?.primaryEdit === true
          ? sourceEditor.presentation === "inline"
            ? "nvim_inline"
            : "nvim"
          : descriptor.presentation ?? "dialog";
      const presentation = requestedPresentation ?? defaultPresentation;
      if (presentation === "inline" && descriptor.renderInline === undefined) {
        throw new Error(`Block editor ${block.typeId} does not provide an inline surface`);
      }
      if (
        (presentation === "nvim" || presentation === "nvim_inline") &&
        descriptor.sourceEditor === undefined
      ) {
        throw new Error(`Block editor ${block.typeId} does not provide source editing`);
      }
      selectSingleBlock(block.id, false);
      setBlockContextMenu(null);
      setPreloadSuppressedBlockId(null);
      activateEditor(block, presentation);
      const blockLayout = layout.blocks.find(({ block: candidate }) => candidate.id === block.id);
      if (
        presentation !== "nvim_inline" &&
        canvasApi !== null &&
        blockLayout !== undefined
      ) {
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
    [activateEditor, canvasApi, layout.blocks, registry, selectSingleBlock],
  );

  const editingDescriptor =
    editingBlock === null ? null : registry.editorForBlock(editingBlock);
  const closeEditor = useCallback(() => {
    const blockId = editingBlock?.id ?? null;
    setPreloadSuppressedBlockId(blockId);
    clearEditorState();
    if (blockId !== null) {
      focusBlockControl(blockId);
    }
  }, [clearEditorState, editingBlock, focusBlockControl]);

  const handleBlockKeyDown = useCallback(
    (block: BuilderBlock, event: ReactKeyboardEvent<HTMLElement>): void => {
      if (
        selectedBlockIdsRef.current.length !== 1 ||
        selectedBlockIdsRef.current[0] !== block.id
      ) {
        return;
      }
      const orderedBlockIds = flattenBuilderBlocks(snapshot.blocks).map(({ id }) => id);
      if (event.key === "Enter") {
        event.preventDefault();
        beginEdit(block);
        return;
      }
      if (
        event.key.toLowerCase() === "v" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        registry.editorForBlock(block)?.sourceEditor !== undefined
      ) {
        event.preventDefault();
        const sourceEditor = registry.editorForBlock(block)?.sourceEditor;
        beginEdit(
          block,
          sourceEditor?.presentation === "inline" ? "nvim_inline" : "nvim",
        );
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteBlocks([block.id]);
        return;
      }
      const direction =
        event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : null;
      const targetId =
        direction === null
          ? event.key === "Home"
            ? orderedBlockIds[0] ?? null
            : event.key === "End"
              ? orderedBlockIds.at(-1) ?? null
              : null
          : adjacentBlockId(orderedBlockIds, block.id, direction);
      if (targetId !== null) {
        event.preventDefault();
        selectSingleBlock(targetId);
      }
    },
    [beginEdit, deleteBlocks, registry, selectSingleBlock, snapshot.blocks],
  );

  const openBlockContextMenu = useCallback(
    (block: BuilderBlock, clientX: number, clientY: number): void => {
      selectSingleBlock(block.id, false);
      const sourceEditor = registry.editorForBlock(block)?.sourceEditor;
      if (
        sourceEditor?.preloadOnContextMenu === true &&
        (editingPresentation === null || editingPresentation === "nvim_preload") &&
        editingBlock?.id !== block.id
      ) {
        activateEditor(block, "nvim_preload");
      }
      setBlockContextMenu({ blockId: block.id, clientX, clientY });
    },
    [activateEditor, editingBlock, editingPresentation, registry, selectSingleBlock],
  );
  const beginPresentation = useCallback(() => {
    if (layoutMode !== "slides") {
      return;
    }
    clearDrag();
    setPendingDetach(null);
    clearEditorState();
    setBlockContextMenu(null);
    setPresentationSlide(layout.visiblePageRange.start);
    setPresentationOpen(true);
    void document.documentElement.requestFullscreen().catch(() => {
      // The overlay remains usable when a browser denies fullscreen access.
    });
  }, [clearDrag, clearEditorState, layout.visiblePageRange.start, layoutMode]);
  const exitPresentation = useCallback(() => {
    setPresentationOpen(false);
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen().catch(() => {
        // Closing the overlay is sufficient if the browser owns fullscreen state.
      });
    }
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
          ordinal: (() => {
            const occurrence = registry.numberedOccurrencesForBlock(editingDraft)[0];
            return occurrence === undefined
              ? null
              : blockOrdinals.get(occurrence.occurrenceId)?.ordinal ?? null;
          })(),
          onPreview: previewEditorBlock,
          onCancel: closeEditor,
          onCommit: commitEditorBlock,
          referenceTargets,
          inlineOrdinals,
          blockOrdinals,
          documentResources,
        };
  const editingContextAction =
    editingContextActionId === null
      ? null
      : editingDescriptor?.contextActions?.find(
          (action): action is BuilderBlockContextEditorAction =>
            action.kind === "editor" && action.id === editingContextActionId,
        ) ?? null;
  const inlineEditor =
    editingPresentation === "inline" &&
    editingDescriptor?.renderInline !== undefined &&
    editorProps !== null
      ? {
          blockId: editorProps.block.id,
          title: editingDescriptor.title(editorProps.block),
          content: editingDescriptor.renderInline(editorProps),
        }
      : null;
  const nvimInlineStyle = useMemo<CSSProperties | undefined>(() => {
    if (
      editingPresentation !== "nvim_inline" ||
      editingBlock === null ||
      viewport === null
    ) {
      return undefined;
    }
    const blockLayout = layout.blocks.find(
      ({ block: candidate }) => candidate.id === editingBlock.id,
    );
    if (blockLayout === undefined) {
      return undefined;
    }
    const origin = sceneCoordsToViewportCoords(
      { sceneX: blockLayout.bounds.x, sceneY: blockLayout.bounds.y },
      viewport,
    );
    const width = Math.max(1, blockLayout.bounds.width * viewport.zoom.value);
    const height = Math.max(1, blockLayout.bounds.height * viewport.zoom.value);
    return {
      left: origin.x,
      top: origin.y,
      width,
      height,
    };
  }, [editingBlock, editingPresentation, layout.blocks, viewport]);

  useEffect(() => {
    if (editingPresentation !== "nvim_inline" || editingBlock === null) {
      return;
    }
    let frame: number | null = null;
    const startedAt = performance.now();
    const syncToRenderedBlock = (): void => {
      const host = nvimInlineHostRef.current;
      const block = [...document.querySelectorAll<HTMLElement>("[data-block-id]")]
        .find((candidate) => candidate.dataset.blockId === editingBlock.id);
      if (host !== null && block !== undefined) {
        const bounds = block.getBoundingClientRect();
        host.style.left = `${String(bounds.left)}px`;
        host.style.top = `${String(bounds.top)}px`;
        host.style.width = `${String(bounds.width)}px`;
        host.style.height = `${String(bounds.height)}px`;
      }
      if (performance.now() - startedAt < 500) {
        frame = requestAnimationFrame(syncToRenderedBlock);
      }
    };
    frame = requestAnimationFrame(syncToRenderedBlock);
    globalThis.addEventListener("resize", syncToRenderedBlock);
    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      globalThis.removeEventListener("resize", syncToRenderedBlock);
    };
  }, [editingBlock, editingPresentation, viewport]);

  const moveBlockBy = useCallback(
    (block: BuilderBlock, direction: -1 | 1): void => {
      const location = findBuilderBlock(snapshot.blocks, block.id);
      if (location === null) {
        return;
      }
      const siblings = siblingBlocks(
        snapshot.blocks,
        location.parentId,
        location.parentSequenceId,
      );
      const targetIndex = location.index + direction;
      if (targetIndex < 0 || targetIndex >= siblings.length) {
        return;
      }
      moveBlocksWithUndo(
        {
          kind: "move",
          blockId: block.id,
          parentId: location.parentId,
          parentSequenceId: location.parentSequenceId,
          index: targetIndex,
        },
        [block.id],
      );
      selectSingleBlock(block.id);
    },
    [moveBlocksWithUndo, selectSingleBlock, snapshot.blocks],
  );

  const duplicateBlock = useCallback(
    (block: BuilderBlock): void => {
      const location = findBuilderBlock(snapshot.blocks, block.id);
      if (location === null) {
        return;
      }
      const copy = copyBuilderBlockForInsert(block, registry);
      insertBlocksWithUndo([
        {
          kind: "insert",
          parentId: location.parentId,
          parentSequenceId: location.parentSequenceId,
          index: location.index + 1,
          block: copy,
        },
      ]);
      selectSingleBlock(copy.id);
    },
    [insertBlocksWithUndo, registry, selectSingleBlock, snapshot.blocks],
  );

  const contextBlockLocation =
    blockContextMenu === null
      ? null
      : findBuilderBlock(snapshot.blocks, blockContextMenu.blockId);
  const contextBlock = contextBlockLocation?.block ?? null;
  const contextEditor =
    contextBlock === null ? null : registry.editorForBlock(contextBlock);
  const contextSiblings =
    contextBlockLocation === null
      ? []
      : siblingBlocks(
          snapshot.blocks,
          contextBlockLocation.parentId,
          contextBlockLocation.parentSequenceId,
        );
  const beginContextEditor = useCallback(
    (block: BuilderBlock, action: BuilderBlockContextEditorAction): void => {
      beginEdit(block, "dialog");
      setEditingContextActionId(action.id);
    },
    [beginEdit],
  );
  const recoverDeletedBlock = useCallback(
    (deletedBlock: BuilderBlock, afterBlockId: string): void => {
      const currentBlocks = port.getSnapshot().blocks;
      const target = findBuilderBlock(currentBlocks, afterBlockId);
      if (target === null) {
        return;
      }
      const recovered = findBuilderBlock(currentBlocks, deletedBlock.id) === null
        ? deletedBlock
        : copyBuilderBlockForInsert(deletedBlock, registry);
      insertBlocksWithUndo([
        {
          kind: "insert",
          parentId: target.parentId,
          parentSequenceId: target.parentSequenceId,
          index: target.index + 1,
          block: recovered,
        },
      ]);
      setRecentlyDeletedBlocks((current) =>
        Object.freeze(current.filter(({ id }) => id !== deletedBlock.id)),
      );
      selectSingleBlock(recovered.id);
    },
    [insertBlocksWithUndo, port, registry, selectSingleBlock],
  );
  const recoveryItems = recentlyDeletedBlocks.map((deletedBlock) => {
    const adapter = registry.pluginForBlock(deletedBlock);
    const occurrence = registry.numberedOccurrencesForBlock(deletedBlock)[0];
    return {
      id: `recover-${deletedBlock.id}`,
      label: adapter.palette.label,
      glyph: adapter.palette.glyph,
      preview: (
        <div
          className="block-recovery-preview"
          data-recovery-block-type={deletedBlock.typeId}
        >
          {adapter.renderPreview(deletedBlock, {
            documentIndex: -1,
            numberingSeries: occurrence?.numberingSeries ?? null,
            ordinal: null,
            documentBlocks: snapshot.blocks,
            sectionDepth: 0,
            referenceTargets,
            inlineOrdinals,
            blockOrdinals,
            documentResources,
            childSequenceLayouts: [],
          })}
        </div>
      ),
      run: () => {
        if (contextBlock !== null) {
          recoverDeletedBlock(deletedBlock, contextBlock.id);
        }
      },
    };
  });
  const contextActions: readonly BlockRadialAction[] =
    contextBlock === null
      ? []
      : [
          {
            id: "edit",
            label: "Edit",
            glyph: "✎",
            disabled: contextEditor === null,
            run: () => {
              beginEdit(contextBlock);
            },
          },
          ...(contextEditor?.presentation === "inline"
            ? [
                {
                  id: "details",
                  label: "Full editor",
                  glyph: "▣",
                  run: () => {
                    beginEdit(contextBlock, "dialog");
                  },
                },
              ]
            : []),
          ...(contextEditor?.sourceEditor?.primaryEdit === true &&
          contextEditor.renderInline !== undefined
            ? [
                {
                  id: "visual-edit",
                  label: "Visual edit",
                  glyph: "¶",
                  run: () => {
                    beginEdit(contextBlock, "inline");
                  },
                },
              ]
            : []),
          ...(contextEditor?.sourceEditor === undefined
            || contextEditor.sourceEditor.primaryEdit === true
            ? []
            : [
                {
                  id: "nvim",
                  label: "Neovim",
                  glyph: "V",
                  run: () => {
                    beginEdit(
                      contextBlock,
                      contextEditor.sourceEditor?.presentation === "inline"
                        ? "nvim_inline"
                        : "nvim",
                    );
                  },
                },
              ]),
          ...(contextEditor?.contextActions ?? []).map((action) => ({
            id: action.id,
            label: action.label,
            glyph: action.glyph,
            run: () => {
              if (action.kind === "editor") {
                beginContextEditor(contextBlock, action);
                return;
              }
              void Promise.resolve(action.run(contextBlock))
                .then((replacement) => {
                  if (replacement === null) {
                    return;
                  }
                  if (
                    replacement.id !== contextBlock.id ||
                    replacement.typeId !== contextBlock.typeId
                  ) {
                    throw new Error("A block context action must preserve block identity");
                  }
                  port.dispatch({
                    kind: "replace",
                    blockId: contextBlock.id,
                    block: replacement,
                  });
                  setTransportError(null);
                })
                .catch((error: unknown) => {
                  setTransportError(
                    error instanceof Error ? error.message : "The block action failed",
                  );
                });
            },
          })),
          {
            id: "up",
            label: "Move up",
            glyph: "↑",
            disabled: contextBlockLocation?.index === 0,
            run: () => {
              moveBlockBy(contextBlock, -1);
            },
          },
          {
            id: "down",
            label: "Move down",
            glyph: "↓",
            disabled:
              contextBlockLocation === null ||
              contextBlockLocation.index + 1 >= contextSiblings.length,
            run: () => {
              moveBlockBy(contextBlock, 1);
            },
          },
          {
            id: "duplicate",
            label: "Duplicate",
            glyph: "⧉",
            run: () => {
              duplicateBlock(contextBlock);
            },
          },
          {
            kind: "branch",
            id: "recover",
            label: "Recover",
            glyph: "↶",
            disabled: recoveryItems.length === 0,
            items: recoveryItems,
          },
          {
            id: "delete",
            label: "Delete",
            glyph: "×",
            run: () => {
              deleteBlocks([contextBlock.id]);
            },
          },
        ];

  const saveDocument = useCallback((): void => {
    try {
      const source = transport.toString(port.getSnapshot());
      const url = URL.createObjectURL(
        new Blob([source], { type: "application/json;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "document.dans_doc";
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
        clearEditorState();
        setBlockContextMenu(null);
        setRecentlyDeletedBlocks([]);
        undoStackRef.current = [];
        port.dispatch({ kind: "replace_all", ...decoded });
        setTransportError(null);
      } catch (error) {
        setTransportError(error instanceof Error ? error.message : "Could not load document");
      }
    },
    [clearDrag, clearEditorState, port, registry, transport],
  );

  return (
    <main className="builder-shell">
      <section className="canvas-host" aria-label="Excalidraw notes canvas and document builder">
        <div className="document-page-layer" aria-hidden={pageStyle === undefined}>
          {pageStyle === undefined ? null : (
            <DocumentVisualPage
              layout={layout}
              pageStyle={pageStyle}
              registry={registry}
              layer="background"
            />
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
          onPointerDown={() => {
            clearBlockSelection();
          }}
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
            onPresent={beginPresentation}
            onBeginDrag={beginPaletteDrag}
          />
          <Footer>
            <Sidebar.Trigger name={blocksSidebarName} title="Open document blocks">
              <span className="blocks-trigger">▦ Blocks</span>
            </Sidebar.Trigger>
          </Footer>
        </Excalidraw>

        <div className="document-block-visual-layer" aria-hidden={pageStyle === undefined}>
          {pageStyle === undefined ? null : (
            <DocumentVisualPage
              layout={layout}
              pageStyle={pageStyle}
              registry={registry}
              layer="blocks"
            />
          )}
        </div>

        <div
          ref={documentControlLayerRef}
          className={`document-control-layer${middlePanning ? " document-control-layer--panning" : ""}`}
          aria-hidden={pageStyle === undefined}
          onPointerDown={beginDocumentMiddlePan}
          onAuxClick={(event) => {
            if (event.button === 1) {
              event.preventDefault();
            }
          }}
        >
          {pageStyle === undefined ? null : (
            <DocumentControls
              layout={layout}
              pageStyle={pageStyle}
              registry={registry}
              selectedBlockIds={new Set(selectedBlockIds)}
              onBlockPointerDown={beginDocumentPointer}
              onDeleteSelected={deleteSelectedBlocks}
              onEdit={beginEdit}
              onBlockKeyDown={handleBlockKeyDown}
              onOpenContextMenu={openBlockContextMenu}
              inlineEditor={inlineEditor}
            />
          )}
        </div>

        {blockContextMenu === null || contextBlock === null ? null : (
          <BlockRadialMenu
            label={registry.pluginForBlock(contextBlock).palette.label}
            glyph={registry.pluginForBlock(contextBlock).palette.glyph}
            clientX={blockContextMenu.clientX}
            clientY={blockContextMenu.clientY}
            actions={contextActions}
            onClose={() => {
              setBlockContextMenu(null);
              focusBlockControl(contextBlock.id);
            }}
          />
        )}

        {activeDrag === null ? null : (
          <DragGhost
            clientX={activeDrag.clientX}
            clientY={activeDrag.clientY}
            destination={dragDestination}
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
              destination={null}
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
                deleteBlocks([pendingDetach.block.id]);
                setPendingDetach(null);
              }}
            />
          </>
        )}

        {editingDescriptor === null ||
        editingPresentation !== "dialog" ||
        editorProps === null ? null : (
          <EditorDialog
            title={
              editingContextAction === null
                ? editingDescriptor.title(editorProps.block)
                : editingContextAction.title(editorProps.block)
            }
            onClose={closeEditor}
          >
            {editingContextAction === null
              ? editingDescriptor.render(editorProps)
              : editingContextAction.render(editorProps)}
          </EditorDialog>
        )}

        {editingDescriptor?.sourceEditor === undefined ||
        (editingPresentation !== "nvim" &&
          editingPresentation !== "nvim_inline" &&
          editingPresentation !== "nvim_preload") ||
        editorProps === null ? null : (
          <div
            ref={nvimInlineHostRef}
            className={`nvim-editor-host nvim-editor-host--${
              editingPresentation === "nvim_preload"
                ? "preload"
                : editingPresentation === "nvim_inline"
                  ? "inline"
                  : "dialog"
            }`}
            style={nvimInlineStyle}
            aria-hidden={editingPresentation === "nvim_preload"}
          >
            <NvimBlockEditor
              key={editorProps.block.id}
              {...editorProps}
              sourceEditor={editingDescriptor.sourceEditor}
              visible={editingPresentation !== "nvim_preload"}
            />
          </div>
        )}

        {presentationOpen ? (
          <PresentationView
            layout={presentationLayout}
            registry={registry}
            currentSlide={presentationLayout.visiblePageRange.start}
            onCurrentSlideChange={setPresentationSlide}
            onExit={exitPresentation}
          />
        ) : null}
      </section>
    </main>
  );
}
