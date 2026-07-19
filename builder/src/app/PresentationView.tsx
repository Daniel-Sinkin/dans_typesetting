// Present one development-writer slide at a time in a fullscreen-friendly overlay.
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { DocumentLayout } from "../builder/layout";
import type { BuilderPluginRegistry } from "../builder/plugin";
import { DocumentVisualPage } from "./DocumentPage";

interface PresentationViewProps {
  readonly layout: DocumentLayout;
  readonly registry: BuilderPluginRegistry;
  readonly currentSlide: number;
  readonly onCurrentSlideChange: (slide: number) => void;
  readonly onExit: () => void;
}

interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

function currentViewportSize(): ViewportSize {
  return { width: globalThis.innerWidth, height: globalThis.innerHeight };
}

export function PresentationView({
  layout,
  registry,
  currentSlide,
  onCurrentSlideChange,
  onExit,
}: PresentationViewProps) {
  const [viewport, setViewport] = useState(currentViewportSize);
  const totalSlides = layout.totalPageCount;

  useEffect(() => {
    const handleResize = (): void => {
      setViewport(currentViewportSize());
    };
    globalThis.addEventListener("resize", handleResize);
    return () => {
      globalThis.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          event.preventDefault();
          onCurrentSlideChange(Math.min(totalSlides, currentSlide + 1));
          return;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          onCurrentSlideChange(Math.max(1, currentSlide - 1));
          return;
        case "Home":
          event.preventDefault();
          onCurrentSlideChange(1);
          return;
        case "End":
          event.preventDefault();
          onCurrentSlideChange(totalSlides);
          return;
        case "Escape":
          onExit();
          return;
      }
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentSlide, onCurrentSlideChange, onExit, totalSlides]);

  const stageStyle = useMemo<CSSProperties>(() => {
    const marginPx = 28;
    const availableWidth = Math.max(1, viewport.width - 2 * marginPx);
    const availableHeight = Math.max(1, viewport.height - 2 * marginPx);
    const scale = Math.min(
      availableWidth / layout.pageBounds.width,
      availableHeight / layout.pageBounds.height,
    );
    return {
      width: layout.pageBounds.width,
      height: layout.pageBounds.height,
      transform: `scale(${String(scale)})`,
    };
  }, [layout.pageBounds, viewport]);

  const pageStyle = useMemo<CSSProperties>(
    () => ({
      width: layout.pageBounds.width,
      height: layout.pageBounds.height,
    }),
    [layout.pageBounds],
  );

  return (
    <section
      className="presentation-overlay"
      data-testid="presentation-overlay"
      aria-label="Slide presentation"
    >
      <div className="presentation-stage" style={stageStyle}>
        <DocumentVisualPage layout={layout} pageStyle={pageStyle} registry={registry} />
      </div>
      <nav className="presentation-controls" aria-label="Presentation controls">
        <button
          type="button"
          disabled={currentSlide <= 1}
          aria-label="Previous slide"
          onClick={() => {
            onCurrentSlideChange(Math.max(1, currentSlide - 1));
          }}
        >
          ←
        </button>
        <output>
          {currentSlide} / {totalSlides}
        </output>
        <button
          type="button"
          disabled={currentSlide >= totalSlides}
          aria-label="Next slide"
          onClick={() => {
            onCurrentSlideChange(Math.min(totalSlides, currentSlide + 1));
          }}
        >
          →
        </button>
        <button type="button" onClick={onExit}>
          Exit
        </button>
      </nav>
    </section>
  );
}
