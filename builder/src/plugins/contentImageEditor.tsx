import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import type { BuilderBlockEditorProps } from "../builder/plugin";
import { readFileAsDataUrl, readImageDimensions } from "./imageFile";
import {
  createContentImageBlock,
  requireContentImageBlock,
  type ContentImageBlock,
} from "./contentImageModel";

export function ContentImagePreview({
  image,
}: Readonly<{ image: ContentImageBlock }>) {
  return (
    <div className="image-content image-content--bare">
      <img
        src={image.source}
        alt="Document image"
        style={{ width: `${String(image.widthFraction * 100)}%` }}
      />
    </div>
  );
}

export function ContentImageEditor({
  block,
  onPreview,
  onCommit,
  onCancel,
}: BuilderBlockEditorProps) {
  const image = requireContentImageBlock(block);
  const [source, setSource] = useState(image.source);
  const [widthFraction, setWidthFraction] = useState(image.widthFraction);
  const [pixelWidth, setPixelWidth] = useState(image.preferredPixelWidth);
  const [pixelHeight, setPixelHeight] = useState(image.preferredPixelHeight);
  const [selectedFileName, setSelectedFileName] = useState("Current document image");
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const valid = !isReading && source.trim().length > 0;
  const draft = useMemo(
    () =>
      createContentImageBlock(
        image.id,
        source,
        widthFraction,
        pixelWidth,
        pixelHeight,
      ),
    [image.id, pixelHeight, pixelWidth, source, widthFraction],
  );

  useEffect(() => {
    if (valid) {
      onPreview(draft);
    }
  }, [draft, onPreview, valid]);

  const consumeSelectedFile = (file: File): void => {
    setIsReading(true);
    setError(null);
    void readFileAsDataUrl(file)
      .then(async (nextSource) => {
        const dimensions = await readImageDimensions(nextSource);
        setSource(nextSource);
        setPixelWidth(dimensions.width);
        setPixelHeight(dimensions.height);
        setSelectedFileName(file.name);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "The image could not be read",
        );
      })
      .finally(() => {
        setIsReading(false);
      });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file !== undefined) {
      consumeSelectedFile(file);
    }
  };

  return (
    <form
      className="block-editor-form image-editor content-image-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onCommit(draft);
        }
      }}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        data-testid="image-file-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
      <section className="image-editor-preview">
        <ContentImagePreview image={draft} />
        <span>{selectedFileName}</span>
        <small>
          {pixelWidth} × {pixelHeight} px · height follows the image ratio
        </small>
      </section>
      <button
        className="choose-file-action"
        type="button"
        onClick={() => {
          inputRef.current?.click();
        }}
      >
        Choose another image…
      </button>
      {error === null ? null : <p className="editor-error">{error}</p>}
      <label className="editor-field">
        <span>Preferred width · {Math.round(widthFraction * 100)}%</span>
        <input
          type="range"
          min="20"
          max="100"
          value={Math.round(widthFraction * 100)}
          onChange={(event) => {
            setWidthFraction(Number(event.target.value) / 100);
          }}
        />
      </label>
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-action" type="submit" disabled={!valid}>
          {isReading ? "Reading image…" : "Save image"}
        </button>
      </div>
    </form>
  );
}
