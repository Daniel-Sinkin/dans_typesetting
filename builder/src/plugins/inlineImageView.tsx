// Preview and edit an emoji-sized image without leaking figure semantics.
import { useState } from "react";

import type { BuilderInlineEditorProps } from "../builder/inlinePlugin";
import { readFileAsDataUrl } from "./imageFile";
import {
  createInlineImage,
  requireInlineImage,
  type InlineImageNode,
} from "./inlineImageModel";

export function InlineImagePreview({
  inline,
}: Readonly<{ inline: InlineImageNode }>) {
  return (
    <img
      className="inline-image-content"
      data-inline-image-id={inline.id}
      src={inline.source}
      alt=""
      draggable={false}
      style={{ height: `${String(inline.heightEm)}em` }}
      title={inline.source}
    />
  );
}

export function InlineImageEditor({ inline, onChange }: BuilderInlineEditorProps) {
  const image = requireInlineImage(inline);
  const [sourceDraft, setSourceDraft] = useState(image.source);
  const [heightDraft, setHeightDraft] = useState(String(image.heightEm));
  const [fileName, setFileName] = useState("Current image source");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const parsedPreviewHeight = Number(heightDraft);
  const previewHeight =
    Number.isFinite(parsedPreviewHeight) && parsedPreviewHeight > 0
      ? parsedPreviewHeight
      : image.heightEm;

  const publish = (source: string, height: string): void => {
    const parsedHeight = Number(height);
    try {
      onChange(createInlineImage(source, parsedHeight, image.id));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The inline image is invalid");
    }
  };

  return (
    <div className="inline-image-editor" data-inline-image-editor-id={image.id}>
      <div className="inline-image-editor__preview">
        {sourceDraft.trim().length === 0 ? (
          <span>No image source</span>
        ) : (
          <InlineImagePreview
            inline={{ ...image, source: sourceDraft, heightEm: previewHeight }}
          />
        )}
      </div>
      <label className="editor-field">
        <span>Image source</span>
        <input
          type="text"
          data-inline-image-source={image.id}
          value={sourceDraft}
          onChange={(event) => {
            const source = event.target.value;
            setSourceDraft(source);
            publish(source, heightDraft);
          }}
        />
      </label>
      <label className="editor-field">
        <span>Height relative to surrounding text (em)</span>
        <input
          type="number"
          data-inline-image-height={image.id}
          min="0.1"
          max="8"
          step="0.1"
          value={heightDraft}
          onChange={(event) => {
            const height = event.target.value;
            setHeightDraft(height);
            publish(sourceDraft, height);
          }}
        />
      </label>
      <label className="choose-file-action">
        {reading ? "Reading image…" : "Choose image…"}
        <input
          className="visually-hidden"
          data-inline-image-file={image.id}
          type="file"
          accept="image/*"
          disabled={reading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file === undefined) {
              return;
            }
            setReading(true);
            void readFileAsDataUrl(file)
              .then((source) => {
                setSourceDraft(source);
                setFileName(file.name);
                publish(source, heightDraft);
              })
              .catch((cause: unknown) => {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "The selected inline image could not be read",
                );
              })
              .finally(() => {
                setReading(false);
              });
          }}
        />
      </label>
      <small>{fileName}</small>
      {error === null ? null : <p className="editor-error">{error}</p>}
    </div>
  );
}
