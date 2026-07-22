import { describe, expect, it } from "vitest";

import type { AppState } from "@excalidraw/excalidraw/types";
import { viewportAfterMiddleDrag, viewportAfterWheel } from "./viewportGestures";

const state = {
  offsetLeft: 20,
  offsetTop: 30,
  scrollX: -100,
  scrollY: -50,
  zoom: { value: 1 as AppState["zoom"]["value"] },
} as AppState;

describe("document-overlay canvas gestures", () => {
  it("keeps the scene point under the cursor fixed while zooming", () => {
    const clientX = 420;
    const clientY = 330;
    const beforeX = (clientX - state.offsetLeft) / state.zoom.value - state.scrollX;
    const beforeY = (clientY - state.offsetTop) / state.zoom.value - state.scrollY;
    const next = viewportAfterWheel(state, {
      clientX,
      clientY,
      deltaX: 0,
      deltaY: -10,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    });

    expect(next.zoom.value).toBeGreaterThan(state.zoom.value);
    expect((clientX - state.offsetLeft) / next.zoom.value - next.scrollX)
      .toBeCloseTo(beforeX);
    expect((clientY - state.offsetTop) / next.zoom.value - next.scrollY)
      .toBeCloseTo(beforeY);
  });

  it("uses the same scene-scaled motion for middle-button panning", () => {
    const next = viewportAfterMiddleDrag(state, 30, -20);

    expect(next.scrollX).toBe(-70);
    expect(next.scrollY).toBe(-70);
    expect(next.zoom).toBe(state.zoom);
  });
});
