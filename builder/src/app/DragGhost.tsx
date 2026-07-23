// builder/src/app/DragGhost.tsx — show transient pointer feedback without mutating the document.
import type { ResolvedBuilderAdapter } from "../builder/plugin";

interface DragGhostProps {
  readonly clientX: number;
  readonly clientY: number;
  readonly destination: string | null;
  readonly mode: "insert" | "move" | "copy" | "detached";
  readonly plugin: ResolvedBuilderAdapter;
}

export function DragGhost({ clientX, clientY, destination, mode, plugin }: DragGhostProps) {
  const operation =
    mode === "copy" ? "Copy" : mode === "detached" ? "Detached" : mode === "move" ? "Move" : "Insert";
  const detail = mode === "detached"
    ? "Awaiting deletion decision"
    : destination ?? "Move over the page";
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
      <small>{detail}</small>
    </div>
  );
}
