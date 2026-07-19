// Browser views for resolved and unresolved semantic cross-references.
import { useId } from "react";

import type {
  BuilderInlineEditorProps,
  BuilderInlineRenderContext,
} from "../builder/inlinePlugin";
import type { BuilderInlineNode } from "../model/document";
import { referenceIdPattern } from "../model/referenceId";
import { requireReference } from "./referenceSupport";

export function ReferencePreview({
  inline,
  context,
}: Readonly<{
  inline: BuilderInlineNode;
  context: BuilderInlineRenderContext;
}>) {
  const reference = requireReference(inline);
  const target = context.referenceTargets.get(reference.targetReferenceId);
  if (target === undefined) {
    return (
      <span
        className="inline-reference inline-reference--unresolved"
        title={`No document target named ${reference.targetReferenceId}`}
      >
        Unresolved reference [{reference.targetReferenceId}]
      </span>
    );
  }
  return (
    <a
      className="inline-reference"
      href={`#${target.anchorId}`}
      title={target.title ?? target.displayText}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      {target.displayText}
    </a>
  );
}

export function ReferenceEditor({
  inline,
  onChange,
  context,
}: BuilderInlineEditorProps) {
  const reference = requireReference(inline);
  const datalistId = useId();
  const targets = [...context.referenceTargets.values()].sort((left, right) =>
    left.displayText.localeCompare(right.displayText),
  );
  const valid = referenceIdPattern.test(reference.targetReferenceId);
  return (
    <div className="reference-inline-editor">
      <label className="editor-field">
        <span>Semantic target</span>
        <input
          data-reference-inline-id={reference.id}
          list={datalistId}
          required
          pattern="[A-Za-z][A-Za-z0-9_.:-]*"
          value={reference.targetReferenceId}
          aria-invalid={!valid}
          onChange={(event) => {
            onChange(
              Object.freeze({
                ...reference,
                targetReferenceId: event.target.value,
              }),
            );
          }}
        />
        <datalist id={datalistId}>
          {targets.map((target) => (
            <option key={target.referenceId} value={target.referenceId}>
              {target.displayText}{target.title === null ? "" : ` — ${target.title}`}
            </option>
          ))}
        </datalist>
      </label>
      {valid ? (
        <small>
          {context.referenceTargets.get(reference.targetReferenceId)?.displayText ??
            "The target is not present in this document."}
        </small>
      ) : (
        <small className="editor-error">Enter a valid stable reference ID.</small>
      )}
    </div>
  );
}
