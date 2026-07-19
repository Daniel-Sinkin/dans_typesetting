// Edit dynamic category, reference identity, and rich caption independently of content.
import { useEffect, useMemo, useState } from "react";

import type { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import type { BuilderBlockEditorProps } from "../builder/plugin";
import { editableReferenceIdError } from "../builder/referenceEditing";
import {
  captionedContent,
  createCaptionedBlock,
  isValidNumberingCategory,
  requireCaptionedBlock,
  type CaptionedBlock,
} from "./captionedModel";
import {
  InlineSequenceEditor,
  InlineSequencePreview,
} from "./inlineSequenceView";

interface CaptionedEditorProps extends BuilderBlockEditorProps {
  readonly inlineRegistry: BuilderInlinePluginRegistry;
}

export function CaptionedEditor({
  block,
  inlineRegistry,
  onPreview,
  onCommit,
  onCancel,
  referenceTargets,
  inlineOrdinals,
  documentResources,
  ordinal,
}: CaptionedEditorProps) {
  const captioned = requireCaptionedBlock(block);
  const [numbered, setNumbered] = useState(captioned.category !== null);
  const [category, setCategory] = useState(captioned.category ?? "Figure");
  const [captionInlines, setCaptionInlines] = useState(captioned.captionInlines);
  const [referenceId, setReferenceId] = useState(captioned.referenceId ?? "");
  const categoryValid = !numbered || isValidNumberingCategory(category);
  const referenceError = numbered
    ? editableReferenceIdError(referenceId, captioned.id, referenceTargets)
    : null;
  const valid = categoryValid && referenceError === null;
  const draft = useMemo<CaptionedBlock>(
    () =>
      Object.freeze({
        ...captioned,
        category: numbered ? category : null,
        captionInlines: Object.freeze([...captionInlines]),
        referenceId:
          numbered && referenceId.length > 0 ? referenceId : null,
      }),
    [captionInlines, captioned, category, numbered, referenceId],
  );
  const renderContext = { referenceTargets, inlineOrdinals, documentResources };

  useEffect(() => {
    if (valid) {
      onPreview(draft);
    }
  }, [draft, onPreview, valid]);

  return (
    <form
      className="block-editor-form captioned-editor"
      data-testid="captioned-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onCommit(
            createCaptionedBlock(
              draft.id,
              captionedContent(draft),
              draft.category,
              draft.captionInlines,
              draft.referenceId,
            ),
          );
        }
      }}
    >
      <section className="captioned-editor__preview">
        <div>
          {draft.category === null ? null : (
            <strong>
              {draft.category} {String(ordinal ?? "?")}
              {draft.captionInlines.length === 0 ? "" : ":"}
            </strong>
          )}{" "}
          <InlineSequencePreview
            inlines={draft.captionInlines}
            registry={inlineRegistry}
            context={renderContext}
          />
        </div>
      </section>
      <label className="editor-field editor-field--checkbox">
        <input
          type="checkbox"
          checked={numbered}
          onChange={(event) => {
            setNumbered(event.currentTarget.checked);
          }}
        />
        <span>Enumerate this caption</span>
      </label>
      <label className="editor-field">
        <span>Numbering category</span>
        <input
          value={category}
          disabled={!numbered}
          placeholder="Figure"
          onChange={(event) => {
            setCategory(event.currentTarget.value);
          }}
        />
      </label>
      {categoryValid ? null : (
        <p className="editor-error">Category must be non-empty and trimmed.</p>
      )}
      <label className="editor-field">
        <span>Reference ID · optional</span>
        <input
          value={referenceId}
          disabled={!numbered}
          pattern="[A-Za-z][A-Za-z0-9_.:-]*"
          placeholder="fig:generated-plot"
          onChange={(event) => {
            setReferenceId(event.currentTarget.value);
          }}
        />
      </label>
      {referenceError === null ? null : (
        <p className="editor-error">{referenceError}</p>
      )}
      <InlineSequenceEditor
        label="Caption"
        inlines={captionInlines}
        registry={inlineRegistry}
        context={renderContext}
        allowEmpty
        onChange={setCaptionInlines}
      />
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-action" type="submit" disabled={!valid}>
          Save caption
        </button>
      </div>
    </form>
  );
}
