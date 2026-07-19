// Select, preview, and configure a rich semantic figure image.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import type {
  BuilderInlinePluginRegistry,
  BuilderInlineRenderContext,
} from "../builder/inlinePlugin";
import type { BuilderBlockEditorProps } from "../builder/plugin";
import { editableReferenceIdError } from "../builder/referenceEditing";
import { readFileAsDataUrl, readImageDimensions } from "./imageFile";
import {
  createImageBlock,
  requireImageBlock,
  type ImageBlock,
} from "./imageModel";
import {
  InlineSequenceEditor,
  InlineSequencePreview,
} from "./inlineSequenceView";
import { richCaptionPlainText } from "./richCaption";

export function ImagePreview({
  image,
  registry,
  context,
  ordinal,
}: Readonly<{
  image: ImageBlock;
  registry: BuilderInlinePluginRegistry;
  context: BuilderInlineRenderContext;
  ordinal: number;
}>) {
  return (
    <figure className="image-content">
      <img
        src={image.source}
        alt={richCaptionPlainText(image.captionInlines, registry)}
        style={{ width: `${String(image.widthFraction * 100)}%` }}
      />
      <figcaption>
        <strong>Figure {ordinal}:</strong>{" "}
        <InlineSequencePreview
          inlines={image.captionInlines}
          registry={registry}
          context={context}
        />
      </figcaption>
    </figure>
  );
}

interface ImageEditorProps extends BuilderBlockEditorProps {
  readonly inlineRegistry: BuilderInlinePluginRegistry;
}

export function ImageEditor({
  block,
  inlineRegistry,
  onPreview,
  onCommit,
  onCancel,
  referenceTargets,
  inlineOrdinals,
  documentResources,
  ordinal,
}: ImageEditorProps) {
  const image = requireImageBlock(block);
  const [source, setSource] = useState(image.source);
  const [captionInlines, setCaptionInlines] = useState(image.captionInlines);
  const [referenceId, setReferenceId] = useState(image.referenceId ?? "");
  const [widthFraction, setWidthFraction] = useState(image.widthFraction);
  const [pixelWidth, setPixelWidth] = useState(image.preferredPixelWidth);
  const [pixelHeight, setPixelHeight] = useState(image.preferredPixelHeight);
  const [selectedFileName, setSelectedFileName] = useState("Current document image");
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openedPickerRef = useRef(false);
  const referenceError = editableReferenceIdError(
    referenceId,
    image.id,
    referenceTargets,
  );
  const valid =
    !isReading &&
    source.trim().length > 0 &&
    captionInlines.length > 0 &&
    referenceError === null;
  const draft = useMemo<ImageBlock>(
    () =>
      Object.freeze({
        id: image.id,
        typeId: image.typeId,
        source,
        captionInlines: Object.freeze([...captionInlines]),
        referenceId: referenceId.length === 0 ? null : referenceId,
        widthFraction,
        preferredPixelWidth: pixelWidth,
        preferredPixelHeight: pixelHeight,
      }),
    [
      captionInlines,
      image.id,
      image.typeId,
      pixelHeight,
      pixelWidth,
      referenceId,
      source,
      widthFraction,
    ],
  );
  const renderContext = { referenceTargets, inlineOrdinals, documentResources };

  useEffect(() => {
    if (openedPickerRef.current) {
      return;
    }
    openedPickerRef.current = true;
    inputRef.current?.click();
  }, []);

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
          reason instanceof Error
            ? reason.message
            : "The selected image could not be read",
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
      className="block-editor-form image-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onCommit(
            createImageBlock(
              draft.id,
              draft.source,
              draft.captionInlines,
              draft.referenceId,
              draft.widthFraction,
              draft.preferredPixelWidth,
              draft.preferredPixelHeight,
            ),
          );
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
        <ImagePreview
          image={draft}
          registry={inlineRegistry}
          context={renderContext}
          ordinal={ordinal ?? 0}
        />
        <span>{selectedFileName}</span>
        <small>
          {pixelWidth} × {pixelHeight} px
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
      {referenceError === null ? null : (
        <p className="editor-error">{referenceError}</p>
      )}
      <label className="editor-field">
        <span>Reference ID · optional</span>
        <input
          value={referenceId}
          pattern="[A-Za-z][A-Za-z0-9_.:-]*"
          placeholder="fig:domain-decomposition"
          onChange={(event) => {
            setReferenceId(event.target.value);
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
        <small>The figure preview uses this width immediately.</small>
      </label>
      <InlineSequenceEditor
        label="Figure caption"
        inlines={captionInlines}
        registry={inlineRegistry}
        context={renderContext}
        onChange={setCaptionInlines}
      />
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
