// builder/src/app/EditorDialog.tsx — host plugin-provided editors without knowing their payload.
import type { ReactNode } from "react";

interface EditorDialogProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
}

export function EditorDialog({ title, children, onClose }: EditorDialogProps) {
  return (
    <div className="dialog-backdrop" data-testid="block-editor-dialog">
      <section className="editor-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="editor-dialog__header">
          <div>
            <span>Plugin editor</span>
            <h2>{title}</h2>
          </div>
          <button type="button" aria-label="Close editor" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="editor-dialog__body">{children}</div>
      </section>
    </div>
  );
}
