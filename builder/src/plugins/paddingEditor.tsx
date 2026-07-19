// Edit backend-neutral Padding intent while previewing nested flow in place.
import { useEffect, useMemo, useState } from "react";

import type { BuilderBlockEditorProps } from "../builder/plugin";
import {
  createPaddingBlock,
  paddingContent,
  requirePaddingBlock,
  type PaddingBlock,
  type PaddingInsets,
} from "./paddingModel";

export function PaddingEditor({
  block,
  onPreview,
  onCommit,
  onCancel,
}: BuilderBlockEditorProps) {
  const padding = requirePaddingBlock(block);
  const [insets, setInsets] = useState<PaddingInsets>(padding.insets);
  const draft = useMemo<PaddingBlock>(
    () => createPaddingBlock(padding.id, insets, paddingContent(padding)),
    [insets, padding],
  );

  useEffect(() => {
    onPreview(draft);
  }, [draft, onPreview]);

  const fields = [
    ["Top", "topEm"],
    ["Right", "rightEm"],
    ["Bottom", "bottomEm"],
    ["Left", "leftEm"],
  ] as const;

  return (
    <form
      className="block-editor-form padding-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onCommit(draft);
      }}
    >
      <p className="editor-note">
        Insets are author intent in em units. Nested blocks remain ordinary semantic
        blocks and can be moved through the document surface.
      </p>
      <div className="padding-editor__fields">
        {fields.map(([label, field]) => (
          <label className="editor-field" key={field}>
            <span>{label} · em</span>
            <input
              type="number"
              min="0"
              step="0.25"
              value={insets[field]}
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber;
                if (Number.isFinite(value) && value >= 0) {
                  setInsets((current) => ({ ...current, [field]: value }));
                }
              }}
            />
          </label>
        ))}
      </div>
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-action" type="submit">
          Save padding
        </button>
      </div>
    </form>
  );
}
