// Render and edit the shared ordered Inline Sequence contract.
import { Fragment } from "react";

import type {
  BuilderInlinePluginRegistry,
  BuilderInlineRenderContext,
} from "../builder/inlinePlugin";
import { createBlockId, type BuilderInlineNode } from "../model/document";
import { InlinePayloadEditor } from "./paragraphEditor";

export function InlineSequencePreview({
  inlines,
  registry,
  context,
}: Readonly<{
  inlines: readonly BuilderInlineNode[];
  registry: BuilderInlinePluginRegistry;
  context: BuilderInlineRenderContext;
}>) {
  return inlines.map((inline) => (
    <Fragment key={inline.id}>
      {registry.adapterForInline(inline).renderPreview(inline, registry, context)}
    </Fragment>
  ));
}

export interface InlineSequenceEditorProps {
  readonly label: string;
  readonly inlines: readonly BuilderInlineNode[];
  readonly registry: BuilderInlinePluginRegistry;
  readonly context: BuilderInlineRenderContext;
  readonly onChange: (inlines: readonly BuilderInlineNode[]) => void;
}

function moveEntry<T>(entries: readonly T[], from: number, to: number): readonly T[] {
  if (to < 0 || to >= entries.length) {
    return entries;
  }
  const moved = [...entries];
  const [entry] = moved.splice(from, 1);
  if (entry === undefined) {
    return entries;
  }
  moved.splice(to, 0, entry);
  return Object.freeze(moved);
}

export function InlineSequenceEditor({
  label,
  inlines,
  registry,
  context,
  onChange,
}: InlineSequenceEditorProps) {
  return (
    <section className="inline-sequence-editor">
      <header>
        <div>
          <strong>{label}</strong>
          <small>Ordered semantic inline sequence</small>
        </div>
        <div className="inline-sequence-editor__composed">
          <InlineSequencePreview
            inlines={inlines}
            registry={registry}
            context={context}
          />
        </div>
      </header>
      <div className="inline-sequence-editor__segments">
        {inlines.map((inline, index) => {
          const adapter = registry.adapterForInline(inline);
          return (
            <section data-inline-sequence-id={inline.id} key={inline.id}>
              <header>
                <b style={{ background: adapter.palette.accentColor }}>
                  {adapter.palette.glyph}
                </b>
                <strong>{adapter.palette.label}</strong>
                <code>{inline.typeId}</code>
                <button
                  type="button"
                  aria-label={`Move segment ${String(index + 1)} left`}
                  disabled={index === 0}
                  onClick={() => {
                    onChange(moveEntry(inlines, index, index - 1));
                  }}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={`Move segment ${String(index + 1)} right`}
                  disabled={index + 1 === inlines.length}
                  onClick={() => {
                    onChange(moveEntry(inlines, index, index + 1));
                  }}
                >
                  →
                </button>
                <button
                  className="danger-action"
                  type="button"
                  disabled={inlines.length === 1}
                  onClick={() => {
                    onChange(inlines.filter((candidate) => candidate.id !== inline.id));
                  }}
                >
                  Remove
                </button>
              </header>
              <InlinePayloadEditor
                inline={inline}
                registry={registry}
                context={context}
                onChange={(replacement) => {
                  if (replacement.id !== inline.id) {
                    throw new Error("An inline-sequence editor must preserve stable identity");
                  }
                  onChange(
                    inlines.map((candidate) =>
                      candidate.id === inline.id ? replacement : candidate,
                    ),
                  );
                }}
              />
            </section>
          );
        })}
      </div>
      <div className="inline-sequence-editor__add">
        <span>Add segment</span>
        {registry.palettePlugins().map((plugin) => (
          <button
            type="button"
            data-add-inline={plugin.typeId}
            key={plugin.typeId}
            title={plugin.palette.description}
            onClick={() => {
              onChange([...inlines, plugin.createDefault(createBlockId())]);
            }}
          >
            <b style={{ background: plugin.palette.accentColor }}>
              {plugin.palette.glyph}
            </b>
            {plugin.palette.label}
          </button>
        ))}
      </div>
    </section>
  );
}
