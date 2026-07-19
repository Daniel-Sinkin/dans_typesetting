# Slide development writer

The graphical builder can project the same semantic document as 16:9 slides.
This is a development-writer policy, not a property added to `Document` or to
individual content plugins.

## Geometry and flow

- A slide is 1280×720 development pixels with writer-owned content insets.
- Blocks retain the same plugin measurements and whole-block pagination policy
  used by paged document view.
- A block that would cross the lower content boundary moves to the next slide.
- A block taller than an entire slide becomes the same conspicuous oversized
  warning used by paged view.
- Explicit page-break blocks advance to a fresh slide without acquiring a
  slide-specific semantic type.
- The editor can project a range of at most five slides around the Excalidraw
  canvas. Free-form notes remain outside the semantic document.

The first implementation deliberately does not introduce slide masters,
transitions, speaker notes, incremental reveals, or PowerPoint export. Those
features require their own semantic decisions instead of being inferred from a
different viewport shape.

## Presentation overlay

`Present` opens the currently selected slide in a reader overlay and requests
the browser Fullscreen API. If fullscreen permission is unavailable, the same
overlay remains usable in the ordinary browser viewport. Arrow keys,
Page Up/Down, Space, Home, and End navigate the derived slide sequence; Escape
or the visible Exit control returns to editing.

The overlay consumes the same registered graphical block adapters as the
authoring surface. It removes development outlines and controls, but it does
not create a second slide document model. Future interactive media can
therefore work in the browser adapter while static writers deliberately lower
the same media to poster/link fallbacks.

## Verification

Unit coverage checks exact 16:9 geometry, whole-block page advancement, and
visible-range selection. The browser smoke test changes from A4 paging to slide
mode, opens the presentation overlay, advances exactly one slide by keyboard,
exits, and captures `builder/test-results/slide-presentation.png` for visual
inspection.
