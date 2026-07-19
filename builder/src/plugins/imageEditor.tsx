// builder/src/plugins/imageEditor.tsx — select, preview, and configure a figure image.
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import type { BuilderBlockEditorProps } from "../builder/plugin";
import {
  isImageBlock,
  type BuilderBlock,
  type ImageBlock,
} from "../model/document";

function requireImage(block: BuilderBlock): ImageBlock {
  if (!isImageBlock(block)) {
    throw new Error(`Image editor cannot consume ${block.typeId}`);
  }
  return block;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("The selected image could not be encoded"));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("The selected image could not be read"));
    });
    reader.readAsDataURL(file);
  });
}

function readImageDimensions(source: string): Promise<Readonly<{ width: number; height: number }>> {
  return new Promise((resolve, reject) => {
    const image = new globalThis.Image();
    image.addEventListener("load", () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    });
    image.addEventListener("error", () => {
      reject(new Error("The selected file is not a browser-renderable image"));
    });
    image.src = source;
  });
}

export function ImageEditor({ block, onCommit, onCancel }: BuilderBlockEditorProps) {
  const image = requireImage(block);
  const [source, setSource] = useState(image.source);
  const [caption, setCaption] = useState(image.caption);
  const [widthFraction, setWidthFraction] = useState(image.widthFraction);
  const [pixelWidth, setPixelWidth] = useState(image.preferredPixelWidth);
  const [pixelHeight, setPixelHeight] = useState(image.preferredPixelHeight);
  const [selectedFileName, setSelectedFileName] = useState("Current document image");
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openedPickerRef = useRef(false);

  useEffect(() => {
    if (openedPickerRef.current) {
      return;
    }
    openedPickerRef.current = true;
    inputRef.current?.click();
  }, []);

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
        setError(reason instanceof Error ? reason.message : "The selected image could not be read");
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
      className="block-editor-form image-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onCommit(
          Object.freeze({
            ...image,
            source,
            caption,
            widthFraction,
            preferredPixelWidth: pixelWidth,
            preferredPixelHeight: pixelHeight,
          }),
        );
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
      <div className="image-editor-preview">
        <div className="image-editor-preview__frame">
          <img
            src={source}
            alt="Selected figure preview"
            style={{ width: `${String(widthFraction * 100)}%` }}
          />
        </div>
        <span>{selectedFileName}</span>
        <small>
          {pixelWidth} × {pixelHeight} px
        </small>
      </div>
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
        <span>Caption</span>
        <textarea
          rows={3}
          value={caption}
          onChange={(event) => {
            setCaption(event.target.value);
          }}
        />
      </label>
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
        <small>The preview above uses this width immediately.</small>
      </label>
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary-action"
          type="submit"
          disabled={isReading || caption.trim().length === 0}
        >
          {isReading ? "Reading image…" : "Save image"}
        </button>
      </div>
    </form>
  );
}
