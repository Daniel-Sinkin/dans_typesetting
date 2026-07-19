// builder/src/app/DetachConfirmation.tsx — confirm destructive out-of-document drops.
import { useState } from "react";

import type { BuilderBlock } from "../model/document";

interface DetachConfirmationProps {
  readonly block: BuilderBlock;
  readonly onCancel: () => void;
  readonly onDelete: (doNotAskAgain: boolean) => void;
}

export function DetachConfirmation({ block, onCancel, onDelete }: DetachConfirmationProps) {
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);

  return (
    <div className="dialog-backdrop dialog-backdrop--confirmation">
      <section
        className="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete detached block?"
      >
        <span className="confirmation-dialog__icon">!</span>
        <div>
          <h2>Delete detached block?</h2>
          <p>
            <code>{block.id}</code> was dropped outside the document. Deleting it cannot currently
            be undone through the document builder.
          </p>
          <label className="confirmation-checkbox">
            <input
              type="checkbox"
              checked={doNotAskAgain}
              onChange={(event) => {
                setDoNotAskAgain(event.target.checked);
              }}
            />
            <span>Don’t ask again; delete future detached blocks immediately</span>
          </label>
          <div className="editor-actions">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="danger-primary-action"
              type="button"
              onClick={() => {
                onDelete(doNotAskAgain);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
