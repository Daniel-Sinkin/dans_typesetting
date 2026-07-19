// Graphical preview and editor for the opinionated two-panel figure extension.
import {
  Fragment,
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
import { referenceIdPattern } from "../model/referenceId";
import { readFileAsDataUrl, readImageDimensions } from "./imageFile";
import {
  createFigurePairBlock,
  createFigurePanel,
  requireFigurePairBlock,
  type BuilderFigurePanel,
  type FigurePairBlock,
} from "./figurePairModel";
import {
  InlineSequenceEditor,
  InlineSequencePreview,
} from "./inlineSequenceView";

function plainCaption(
  panel: BuilderFigurePanel,
  registry: BuilderInlinePluginRegistry,
): string {
  return panel.captionInlines
    .map((inline) => registry.adapterForInline(inline).plainText(inline, registry))
    .join("");
}

export function FigurePairPreview({
  pair,
  registry,
  context,
  ordinal,
}: Readonly<{
  pair: FigurePairBlock;
  registry: BuilderInlinePluginRegistry;
  context: BuilderInlineRenderContext;
  ordinal: number;
}>) {
  return (
    <figure className="figure-pair-content">
      <div className="figure-pair-content__panels">
        {pair.panels.map((panel, index) => {
          const target =
            panel.referenceId === null
              ? null
              : context.referenceTargets.get(panel.referenceId) ?? null;
          return (
            <figure
              data-figure-panel-id={panel.id}
              id={target?.anchorId}
              key={panel.id}
              style={{ width: `${String(pair.panelWidthFraction * 100)}%` }}
            >
              <img src={panel.source} alt={plainCaption(panel, registry)} />
              <figcaption>
                <strong>({index === 0 ? "a" : "b"})</strong>{" "}
                <InlineSequencePreview
                  inlines={panel.captionInlines}
                  registry={registry}
                  context={context}
                />
              </figcaption>
            </figure>
          );
        })}
      </div>
      <figcaption className="figure-pair-content__caption">
        <strong>Figure {ordinal}:</strong>{" "}
        <InlineSequencePreview
          inlines={pair.captionInlines}
          registry={registry}
          context={context}
        />
      </figcaption>
    </figure>
  );
}

interface FigurePairEditorProps extends BuilderBlockEditorProps {
  readonly inlineRegistry: BuilderInlinePluginRegistry;
}

function replacePanel(
  panels: FigurePairBlock["panels"],
  index: number,
  replacement: BuilderFigurePanel,
): FigurePairBlock["panels"] {
  return index === 0
    ? Object.freeze([replacement, panels[1]])
    : Object.freeze([panels[0], replacement]);
}

function panelReferenceError(
  value: string,
  pair: FigurePairBlock,
  referenceTargets: BuilderBlockEditorProps["referenceTargets"],
): string | null {
  return editableReferenceIdError(value, pair.id, referenceTargets);
}

export function FigurePairEditor({
  block,
  inlineRegistry,
  onPreview,
  onCommit,
  onCancel,
  referenceTargets,
  inlineOrdinals,
  documentResources,
  ordinal,
}: FigurePairEditorProps) {
  const pair = requireFigurePairBlock(block);
  const [panels, setPanels] = useState<FigurePairBlock["panels"]>(pair.panels);
  const [captionInlines, setCaptionInlines] = useState(pair.captionInlines);
  const [referenceId, setReferenceId] = useState(pair.referenceId);
  const [panelWidthFraction, setPanelWidthFraction] = useState(
    pair.panelWidthFraction,
  );
  const [readingPanel, setReadingPanel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const groupReferenceError = editableReferenceIdError(
    referenceId,
    pair.id,
    referenceTargets,
  );
  const panelReferenceErrors = panels.map((panel) =>
    panelReferenceError(panel.referenceId ?? "", pair, referenceTargets),
  );
  const localReferenceIds = [
    referenceId,
    ...panels.flatMap((panel) =>
      panel.referenceId === null || panel.referenceId.length === 0
        ? []
        : [panel.referenceId],
    ),
  ];
  const hasDuplicateLocalReferences =
    new Set(localReferenceIds).size !== localReferenceIds.length;
  const valid =
    referenceIdPattern.test(referenceId) &&
    groupReferenceError === null &&
    panelReferenceErrors.every((message) => message === null) &&
    !hasDuplicateLocalReferences &&
    readingPanel === null &&
    captionInlines.length > 0 &&
    panels.every(
      (panel) =>
        panel.source.trim().length > 0 && panel.captionInlines.length > 0,
    );
  const draft = useMemo<FigurePairBlock>(
    () =>
      Object.freeze({
        id: pair.id,
        typeId: pair.typeId,
        panels,
        captionInlines: Object.freeze([...captionInlines]),
        referenceId,
        panelWidthFraction,
      }),
    [captionInlines, pair.id, pair.typeId, panelWidthFraction, panels, referenceId],
  );
  const renderContext = { referenceTargets, inlineOrdinals, documentResources };

  useEffect(() => {
    if (valid) {
      onPreview(draft);
    }
  }, [draft, onPreview, valid]);

  const selectFile = (index: number, file: File): void => {
    setReadingPanel(index);
    setError(null);
    void readFileAsDataUrl(file)
      .then(async (source) => {
        const dimensions = await readImageDimensions(source);
        setPanels((current) => {
          const panel = current[index];
          if (panel === undefined) {
            return current;
          }
          return replacePanel(
            current,
            index,
            createFigurePanel(
              panel.id,
              source,
              panel.captionInlines,
              panel.referenceId,
              dimensions.width,
              dimensions.height,
            ),
          );
        });
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "The selected panel image could not be read",
        );
      })
      .finally(() => {
        setReadingPanel(null);
      });
  };

  const handleFileChange = (
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = event.target.files?.[0];
    if (file !== undefined) {
      selectFile(index, file);
    }
  };

  return (
    <form
      className="block-editor-form figure-pair-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onCommit(
            createFigurePairBlock(
              draft.id,
              draft.panels[0],
              draft.panels[1],
              draft.captionInlines,
              draft.referenceId,
              draft.panelWidthFraction,
            ),
          );
        }
      }}
    >
      <section className="figure-pair-editor__preview">
        <header>
          <strong>Live paired-figure preview</strong>
          <small>Figure {ordinal ?? 0}</small>
        </header>
        <FigurePairPreview
          pair={draft}
          registry={inlineRegistry}
          context={renderContext}
          ordinal={ordinal ?? 0}
        />
      </section>

      <div className="figure-pair-editor__metadata">
        <label className="editor-field">
          <span>Group reference ID · required</span>
          <input
            value={referenceId}
            pattern="[A-Za-z][A-Za-z0-9_.:-]*"
            onChange={(event) => {
              setReferenceId(event.target.value);
            }}
          />
        </label>
        <label className="editor-field">
          <span>
            Width per panel · {Math.round(panelWidthFraction * 100)}%
          </span>
          <input
            type="range"
            min="20"
            max="50"
            value={Math.round(panelWidthFraction * 100)}
            onChange={(event) => {
              setPanelWidthFraction(Number(event.target.value) / 100);
            }}
          />
        </label>
      </div>
      {groupReferenceError === null ? null : (
        <p className="editor-error">{groupReferenceError}</p>
      )}
      {hasDuplicateLocalReferences ? (
        <p className="editor-error">
          Group and panel reference IDs must be distinct.
        </p>
      ) : null}
      {error === null ? null : <p className="editor-error">{error}</p>}

      <div className="figure-pair-editor__panels">
        {panels.map((panel, index) => (
          <section key={panel.id}>
            <header>
              <strong>Panel {index === 0 ? "(a)" : "(b)"}</strong>
              <small>
                {panel.preferredPixelWidth} × {panel.preferredPixelHeight} px
              </small>
            </header>
            <img src={panel.source} alt={`Panel ${String(index + 1)} preview`} />
            <input
              ref={fileInputs[index]}
              className="visually-hidden"
              type="file"
              accept="image/*"
              onChange={(event) => {
                handleFileChange(index, event);
              }}
            />
            <button
              type="button"
              disabled={readingPanel !== null}
              onClick={() => {
                fileInputs[index]?.current?.click();
              }}
            >
              Choose panel image…
            </button>
            <label className="editor-field">
              <span>Panel reference ID · optional</span>
              <input
                value={panel.referenceId ?? ""}
                pattern="[A-Za-z][A-Za-z0-9_.:-]*"
                placeholder={`fig:pair:${index === 0 ? "left" : "right"}`}
                onChange={(event) => {
                  const nextReference =
                    event.target.value.length === 0 ? null : event.target.value;
                  setPanels((current) =>
                    replacePanel(
                      current,
                      index,
                      createFigurePanel(
                        panel.id,
                        panel.source,
                        panel.captionInlines,
                        nextReference,
                        panel.preferredPixelWidth,
                        panel.preferredPixelHeight,
                      ),
                    ),
                  );
                }}
              />
            </label>
            {panelReferenceErrors[index] === null ? null : (
              <p className="editor-error">{panelReferenceErrors[index]}</p>
            )}
          </section>
        ))}
      </div>

      <InlineSequenceEditor
        label="Group caption"
        inlines={captionInlines}
        registry={inlineRegistry}
        context={renderContext}
        onChange={setCaptionInlines}
      />
      {panels.map((panel, index) => (
        <Fragment key={`${panel.id}:caption`}>
          <InlineSequenceEditor
            label={`Panel ${index === 0 ? "(a)" : "(b)"} caption`}
            inlines={panel.captionInlines}
            registry={inlineRegistry}
            context={renderContext}
            onChange={(inlines) => {
              setPanels((current) =>
                replacePanel(
                  current,
                  index,
                  createFigurePanel(
                    panel.id,
                    panel.source,
                    inlines,
                    panel.referenceId,
                    panel.preferredPixelWidth,
                    panel.preferredPixelHeight,
                  ),
                ),
              );
            }}
          />
        </Fragment>
      ))}

      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-action" type="submit" disabled={!valid}>
          {readingPanel === null ? "Save figure pair" : "Reading panel image…"}
        </button>
      </div>
    </form>
  );
}
