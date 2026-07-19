// Focused editors for semantic title-page and section blocks.
import { useState } from "react";

import type { BuilderBlockEditorProps } from "../builder/plugin";
import {
  isSectionBlock,
  isTitlePageBlock,
  type BuilderBlock,
  type SectionBlock,
  type TitlePageBlock,
} from "../model/document";

function requireSection(block: BuilderBlock): SectionBlock {
  if (!isSectionBlock(block)) {
    throw new Error(`Section editor cannot consume ${block.typeId}`);
  }
  return block;
}

function requireTitlePage(block: BuilderBlock): TitlePageBlock {
  if (!isTitlePageBlock(block)) {
    throw new Error(`Title-page editor cannot consume ${block.typeId}`);
  }
  return block;
}

export function TitlePageEditor({ block, onCommit, onCancel }: BuilderBlockEditorProps) {
  const titlePage = requireTitlePage(block);
  const [title, setTitle] = useState(titlePage.title);
  const [author, setAuthor] = useState(titlePage.author);
  const [date, setDate] = useState(titlePage.date);
  const valid = [title, author, date].every((value) => value.trim().length > 0);
  const fields = [
    { label: "Title", value: title, update: setTitle },
    { label: "Author", value: author, update: setAuthor },
    { label: "Date", value: date, update: setDate },
  ];

  return (
    <form
      className="block-editor-form"
      onSubmit={(event) => {
        event.preventDefault();
        onCommit(Object.freeze({ ...titlePage, title, author, date }));
      }}
    >
      {fields.map((field) => (
        <label className="editor-field" key={field.label}>
          <span>{field.label}</span>
          <input
            value={field.value}
            onChange={(event) => {
              field.update(event.target.value);
            }}
          />
        </label>
      ))}
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-action" type="submit" disabled={!valid}>
          Save title page
        </button>
      </div>
    </form>
  );
}

export function SectionEditor({ block, onCommit, onCancel }: BuilderBlockEditorProps) {
  const section = requireSection(block);
  const [title, setTitle] = useState(section.title);
  const [referenceId, setReferenceId] = useState(section.referenceId ?? "");
  return (
    <form
      className="block-editor-form"
      onSubmit={(event) => {
        event.preventDefault();
        onCommit(
          Object.freeze({
            ...section,
            title,
            referenceId: referenceId.trim().length === 0 ? null : referenceId,
          }),
        );
      }}
    >
      <label className="editor-field">
        <span>Section title</span>
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      </label>
      <label className="editor-field">
        <span>Reference ID · optional</span>
        <input
          value={referenceId}
          placeholder="sec:results"
          onChange={(event) => {
            setReferenceId(event.target.value);
          }}
        />
      </label>
      <p className="editor-note">
        Drag blocks into the indented section flow on the document surface.
      </p>
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-action" type="submit" disabled={title.trim().length === 0}>
          Save section
        </button>
      </div>
    </form>
  );
}
