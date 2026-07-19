// builder/src/app/DragGhost.tsx — show transient pointer feedback without mutating the document.
import type { ResolvedBuilderAdapter } from "../builder/plugin";

interface DragGhostProps {
  readonly clientX: number;
  readonly clientY: number;
  readonly insertionIndex: number | null;
  readonly mode: "insert" | "move" | "copy" | "detached";
  readonly plugin: ResolvedBuilderAdapter;
}

export function DragGhost({ clientX, clientY, insertionIndex, mode, plugin }: DragGhostProps) {
  const operation =
    mode === "copy" ? "Copy" : mode === "detached" ? "Detached" : mode === "move" ? "Move" : "Insert";
  return (
    <div
      className="drag-ghost"
      style={{
        left: clientX,
        top: clientY,
        borderColor: plugin.palette.accentColor,
      }}
    >
      <span>{plugin.palette.glyph}</span>
      <strong>
        {operation} {plugin.palette.label}
      </strong>
      <small>
        {mode === "detached"
          ? "Awaiting deletion decision"
          : insertionIndex === null
          ? "Move over the page"
          : `Insert at ${String(insertionIndex + 1)}`}
      </small>
    </div>
  );
}
