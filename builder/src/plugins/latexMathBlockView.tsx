// Preview and text-edit a source-authored LaTeX display equation.
import { useEffect, useMemo, useState } from "react";

import { editableReferenceIdError } from "../builder/referenceEditing";
import type { BuilderBlockEditorProps } from "../builder/plugin";
import {
  latexMathDisplayTypeId,
  latexMathSourceError,
  requireLatexMathDisplay,
  type LatexMathDisplayBlock,
} from "./latexMathModel";
import { LatexMathPreview } from "./latexMathView";

export function LatexMathDisplayPreview({
  block,
  ordinal,
  anchorId,
}: Readonly<{
  block: LatexMathDisplayBlock;
  ordinal: number | null;
  anchorId?: string | undefined;
}>) {
  return (
    <div className="latex-math-display" data-latex-math-display-id={block.id} id={anchorId}>
      <div className="latex-math-display__scroller">
        <LatexMathPreview source={block.source} displayMode />
      </div>
      {block.numbered ? (
        <span className="math-equation-number">({ordinal ?? "?"})</span>
      ) : null}
    </div>
  );
}

export function LatexMathDisplayEditor({
  block,
  onCommit,
  onCancel,
  onPreview,
  blockOrdinals,
  referenceTargets,
}: BuilderBlockEditorProps) {
  const math = requireLatexMathDisplay(block);
  const [source, setSource] = useState(math.source);
  const [numbered, setNumbered] = useState(math.numbered);
  const [referenceId, setReferenceId] = useState(math.referenceId ?? "");
  const sourceError = latexMathSourceError(source, false);
  const referenceError = numbered
    ? editableReferenceIdError(referenceId, math.id, referenceTargets)
    : null;
  const draft = useMemo<LatexMathDisplayBlock>(
    () =>
      Object.freeze({
        id: math.id,
        typeId: latexMathDisplayTypeId,
        source,
        numbered,
        referenceId: numbered && referenceId.length > 0 ? referenceId : null,
      }),
    [math.id, numbered, referenceId, source],
  );
  const valid = sourceError === null && referenceError === null;

  useEffect(() => {
    if (valid) {
      onPreview(draft);
    }
  }, [draft, onPreview, valid]);

  return (
    <form
      className="block-editor-form latex-math-block-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onCommit(draft);
        }
      }}
    >
      <section className="latex-math-source-editor__preview">
        <header>
          <span>Live display preview</span>
          <small>Implicit $$ … $$</small>
        </header>
        <LatexMathDisplayPreview
          block={draft}
          ordinal={blockOrdinals.get(math.id)?.ordinal ?? null}
          anchorId={
            draft.referenceId === null
              ? undefined
              : referenceTargets.get(draft.referenceId)?.anchorId
          }
        />
      </section>
      <label>
        <span>LaTeX math source</span>
        <textarea
          data-latex-math-display-source={math.id}
          rows={9}
          value={source}
          spellCheck={false}
          onChange={(event) => {
            setSource(event.target.value);
          }}
        />
      </label>
      <small className={sourceError === null ? "field-status" : "field-error"}>
        {sourceError ?? "Write only the content inside the implicit display delimiters."}
      </small>
      <label className="editor-checkbox">
        <input
          type="checkbox"
          checked={numbered}
          onChange={(event) => {
            setNumbered(event.target.checked);
            if (!event.target.checked) {
              setReferenceId("");
            }
          }}
        />
        <span>Number this equation</span>
      </label>
      <label>
        <span>Reference ID (optional)</span>
        <input
          value={referenceId}
          disabled={!numbered}
          placeholder="eq:partition-function"
          onChange={(event) => {
            setReferenceId(event.target.value);
          }}
        />
      </label>
      {referenceError === null ? null : <small className="field-error">{referenceError}</small>}
      <footer className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={!valid}>
          Save equation
        </button>
      </footer>
    </form>
  );
}
