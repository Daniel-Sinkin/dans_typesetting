import type { AppState } from "@excalidraw/excalidraw/types";

export interface CanvasWheelGesture {
  readonly clientX: number;
  readonly clientY: number;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export type CanvasViewportUpdate = Pick<AppState, "scrollX" | "scrollY" | "zoom">;

function normalizedZoom(value: number): AppState["zoom"]["value"] {
  return Math.min(30, Math.max(0.1, Math.round(value * 1_000_000) / 1_000_000)) as AppState["zoom"]["value"];
}

/** Mirrors Excalidraw's wheel transform while the document overlay owns hit testing. */
export function viewportAfterWheel(
  appState: AppState,
  gesture: CanvasWheelGesture,
): CanvasViewportUpdate {
  if (gesture.ctrlKey || gesture.metaKey) {
    const sign = Math.sign(gesture.deltaY);
    const absoluteDelta = Math.abs(gesture.deltaY);
    const boundedDelta = Math.min(10, absoluteDelta) * sign;
    let nextZoom = appState.zoom.value - boundedDelta / 100;
    nextZoom +=
      Math.log10(Math.max(1, appState.zoom.value)) *
      -sign *
      Math.min(1, absoluteDelta / 20);
    const normalized = normalizedZoom(nextZoom);
    const appLayerX = gesture.clientX - appState.offsetLeft;
    const appLayerY = gesture.clientY - appState.offsetTop;
    const baseScrollX =
      appState.scrollX + (appLayerX - appLayerX / appState.zoom.value);
    const baseScrollY =
      appState.scrollY + (appLayerY - appLayerY / appState.zoom.value);
    return {
      scrollX: baseScrollX - (appLayerX - appLayerX / normalized),
      scrollY: baseScrollY - (appLayerY - appLayerY / normalized),
      zoom: { value: normalized },
    };
  }
  if (gesture.shiftKey) {
    return {
      scrollX:
        appState.scrollX - (gesture.deltaY || gesture.deltaX) / appState.zoom.value,
      scrollY: appState.scrollY,
      zoom: appState.zoom,
    };
  }
  return {
    scrollX: appState.scrollX - gesture.deltaX / appState.zoom.value,
    scrollY: appState.scrollY - gesture.deltaY / appState.zoom.value,
    zoom: appState.zoom,
  };
}

export function viewportAfterMiddleDrag(
  initial: CanvasViewportUpdate,
  deltaClientX: number,
  deltaClientY: number,
): CanvasViewportUpdate {
  return {
    scrollX: initial.scrollX + deltaClientX / initial.zoom.value,
    scrollY: initial.scrollY + deltaClientY / initial.zoom.value,
    zoom: initial.zoom,
  };
}
