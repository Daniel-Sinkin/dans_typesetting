// Render and edit Core Paragraph's extensible ordered inline sequence.
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type {
  BuilderInlineEditorProps,
  BuilderInlinePluginRegistry,
  BuilderInlineRenderContext,
} from "../builder/inlinePlugin";
import type { BuilderBlockEditorProps } from "../builder/plugin";
import {
  createBlockId,
  isParagraphBlock,
  type BuilderBlock,
  type BuilderInlineNode,
  type ParagraphBlock,
} from "../model/document";
import {
  insertInlineNode,
  moveInlineNode,
  removeInlineNode,
} from "../model/inlineSequence";

function requireParagraph(block: BuilderBlock): ParagraphBlock {
  if (!isParagraphBlock(block)) {
    throw new Error(`Paragraph editor cannot consume ${block.typeId}`);
  }
  return block;
}

export function InlinePayloadEditor({
  inline,
  registry,
  onChange,
  context,
}: BuilderInlineEditorProps) {
  const editor = registry.editorForInline(inline);
  if (editor !== null) {
    return <>{editor.render({ inline, registry, onChange, context })}</>;
  }
  return (
    <div className="inline-payload-opaque">
      <strong>{inline.label ?? "Unsupported inline"}</strong>
      <code>{inline.typeId}</code>
      <small>This connector has no payload editor; the data remains unchanged.</small>
    </div>
  );
}

export function ParagraphPreview({
  paragraph,
  registry,
  context,
}: Readonly<{
  paragraph: ParagraphBlock;
  registry: BuilderInlinePluginRegistry;
  context: BuilderInlineRenderContext;
}>) {
  return (
    <p className="paragraph-content">
      {paragraph.inlines.length === 0 ? (
        <span className="paragraph-content--empty">Empty paragraph</span>
      ) : (
        paragraph.inlines.map((inline) => (
          <Fragment key={inline.id}>
            {registry.adapterForInline(inline).renderPreview(inline, registry, context)}
          </Fragment>
        ))
      )}
    </p>
  );
}

interface InlineDrag {
  readonly source: "palette" | "sequence";
  readonly inline: BuilderInlineNode;
  readonly originInlineId: string | null;
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
}

interface ParagraphEditorProps extends BuilderBlockEditorProps {
  readonly inlineRegistry: BuilderInlinePluginRegistry;
}

export function ParagraphEditor({
  block,
  inlineRegistry,
  onCommit,
  onCancel,
  onPreview,
  referenceTargets,
  inlineOrdinals,
  documentResources,
}: ParagraphEditorProps) {
  const paragraph = requireParagraph(block);
  const [inlines, setInlines] = useState<readonly BuilderInlineNode[]>(paragraph.inlines);
  const [drag, setDrag] = useState<InlineDrag | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  const dragRef = useRef<InlineDrag | null>(null);
  const sequenceRef = useRef<HTMLDivElement>(null);

  const indexAtClientPoint = useCallback((clientX: number, clientY: number): number | null => {
    const sequence = sequenceRef.current;
    if (sequence === null) {
      return null;
    }
    const sequenceBounds = sequence.getBoundingClientRect();
    const tolerancePx = 24;
    if (
      clientX < sequenceBounds.left - tolerancePx ||
      clientX > sequenceBounds.right + tolerancePx ||
      clientY < sequenceBounds.top - tolerancePx ||
      clientY > sequenceBounds.bottom + tolerancePx
    ) {
      return null;
    }
    const items = sequence.querySelectorAll<HTMLElement>("[data-inline-editor-id]");
    for (const [index, item] of [...items].entries()) {
      const bounds = item.getBoundingClientRect();
      if (clientY < bounds.top + bounds.height / 2) {
        return index;
      }
    }
    return items.length;
  }, []);

  const clearDrag = useCallback((): void => {
    dragRef.current = null;
    setDrag(null);
    setInsertionIndex(null);
  }, []);

  useEffect(() => {
    if (drag === null) {
      return;
    }
    const handlePointerMove = (event: PointerEvent): void => {
      const activeDrag = dragRef.current;
      if (activeDrag?.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      const movedDrag = {
        ...activeDrag,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      dragRef.current = movedDrag;
      setDrag(movedDrag);
      setInsertionIndex(indexAtClientPoint(event.clientX, event.clientY));
    };
    const handlePointerUp = (event: PointerEvent): void => {
      const activeDrag = dragRef.current;
      if (activeDrag?.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      const targetIndex = indexAtClientPoint(event.clientX, event.clientY);
      if (targetIndex !== null) {
        setInlines((currentInlines) => {
          if (activeDrag.source === "palette") {
            return insertInlineNode(currentInlines, targetIndex, activeDrag.inline);
          }
          const originIndex = currentInlines.findIndex(
            (inline) => inline.id === activeDrag.originInlineId,
          );
          return originIndex < 0
            ? currentInlines
            : moveInlineNode(currentInlines, originIndex, targetIndex);
        });
      }
      clearDrag();
    };
    const handlePointerCancel = (event: PointerEvent): void => {
      if (dragRef.current?.pointerId === event.pointerId) {
        clearDrag();
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && dragRef.current !== null) {
        event.stopPropagation();
        clearDrag();
      }
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: false });
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clearDrag, drag, indexAtClientPoint]);

  const beginDrag = (
    nextDrag: InlineDrag,
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = nextDrag;
    setDrag(nextDrag);
    setInsertionIndex(null);
  };

  const identity = useState(() => ({ id: paragraph.id, typeId: paragraph.typeId }))[0];
  const draftParagraph = useMemo<ParagraphBlock>(
    () =>
      Object.freeze({
        ...identity,
        inlines: Object.freeze([...inlines]),
      }),
    [identity, inlines],
  );

  useEffect(() => {
    if (inlines.length > 0) {
      onPreview(draftParagraph);
    }
  }, [draftParagraph, inlines.length, onPreview]);

  return (
    <form
      className="block-editor-form paragraph-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (inlines.length > 0) {
          onCommit(draftParagraph);
        }
      }}
    >
      <section className="paragraph-live-preview" aria-label="Live paragraph preview">
        <header>
          <span>Live sequential preview</span>
          <small>{inlines.length} segment{inlines.length === 1 ? "" : "s"}</small>
        </header>
        <div>
          <ParagraphPreview
            paragraph={draftParagraph}
            registry={inlineRegistry}
            context={{ referenceTargets, inlineOrdinals, documentResources }}
          />
        </div>
      </section>

      <section className="inline-palette" aria-label="Inline segment types">
        <div>
          <h3>Segment types</h3>
          <p>Drag a type into any cyan insertion point in the ordered sequence.</p>
        </div>
        <div className="inline-palette__items">
          {inlineRegistry.palettePlugins().map((plugin) => (
            <button
              data-inline-palette={plugin.typeId}
              key={plugin.typeId}
              type="button"
              title={plugin.palette.description}
              onPointerDown={(event) => {
                beginDrag(
                  {
                    source: "palette",
                    inline: plugin.createDefault(createBlockId()),
                    originInlineId: null,
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY,
                  },
                  event,
                );
              }}
            >
              <span style={{ background: plugin.palette.accentColor }}>
                {plugin.palette.glyph}
              </span>
              <strong>{plugin.palette.label}</strong>
              <small>{plugin.palette.description}</small>
              <b>⠿</b>
            </button>
          ))}
        </div>
      </section>

      <p className="editor-guidance">
        Every segment stays in semantic sequence order. Unknown extensions can be moved or removed,
        but their payload remains opaque. A colour span is an explicit wrapper segment rather than
        a visual-only text property.
      </p>

      <div ref={sequenceRef} className="inline-editor-sequence">
        {inlines.map((inline, index) => {
          const adapter = inlineRegistry.adapterForInline(inline);
          return (
            <Fragment key={inline.id}>
              {drag !== null && insertionIndex === index ? (
                <div className="inline-insertion-marker" data-inline-insertion={index}>
                  Insert segment here
                </div>
              ) : null}
              <section
                className="inline-editor-item"
                data-inline-editor-id={inline.id}
                data-inline-type={inline.typeId}
              >
                <header className="inline-editor-item__header">
                  <button
                    className="inline-editor-item__grip"
                    data-inline-grip-id={inline.id}
                    type="button"
                    aria-label={`Move ${adapter.palette.label} segment`}
                    onPointerDown={(event) => {
                      beginDrag(
                        {
                          source: "sequence",
                          inline,
                          originInlineId: inline.id,
                          pointerId: event.pointerId,
                          clientX: event.clientX,
                          clientY: event.clientY,
                        },
                        event,
                      );
                    }}
                  >
                    ⠿
                  </button>
                  <span
                    className="inline-editor-item__glyph"
                    style={{ background: adapter.palette.accentColor }}
                  >
                    {adapter.palette.glyph}
                  </span>
                  <div>
                    <strong>{adapter.palette.label}</strong>
                    <code>{inline.typeId}</code>
                  </div>
                  <small>Segment {index + 1}</small>
                  <button
                    className="inline-editor-item__remove"
                    type="button"
                    aria-label={`Remove ${adapter.palette.label} segment`}
                    onClick={() => {
                      setInlines((currentInlines) => {
                        const currentIndex = currentInlines.findIndex(
                          (candidate) => candidate.id === inline.id,
                        );
                        return currentIndex < 0
                          ? currentInlines
                          : removeInlineNode(currentInlines, currentIndex);
                      });
                    }}
                  >
                    Remove
                  </button>
                </header>
                <div className="inline-editor-item__payload">
                  <InlinePayloadEditor
                    inline={inline}
                    registry={inlineRegistry}
                    context={{ referenceTargets, inlineOrdinals, documentResources }}
                    onChange={(replacement) => {
                      setInlines((currentInlines) =>
                        Object.freeze(
                          currentInlines.map((candidate) =>
                            candidate.id === inline.id ? replacement : candidate,
                          ),
                        ),
                      );
                    }}
                  />
                </div>
              </section>
            </Fragment>
          );
        })}
        {drag !== null && insertionIndex === inlines.length ? (
          <div className="inline-insertion-marker" data-inline-insertion={inlines.length}>
            Insert segment here
          </div>
        ) : null}
        {inlines.length === 0 && drag === null ? (
          <div className="inline-editor-empty">Drag a segment type here to rebuild the paragraph.</div>
        ) : null}
      </div>

      <div className="editor-actions">
        <button type="button" disabled={drag !== null} onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary-action"
          type="submit"
          disabled={drag !== null || inlines.length === 0}
        >
          Save paragraph
        </button>
      </div>

      {drag === null ? null : (
        <div
          className="inline-drag-ghost"
          style={{ left: drag.clientX + 14, top: drag.clientY + 14 }}
        >
          <span>{drag.source === "palette" ? "Insert" : "Move"}</span>
          <strong>{inlineRegistry.adapterForInline(drag.inline).palette.label}</strong>
        </div>
      )}
    </form>
  );
}
