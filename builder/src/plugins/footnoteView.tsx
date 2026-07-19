// Browser preview and nested inline-sequence editor for semantic footnotes.
import { Fragment, useState } from "react";

import type {
  BuilderInlineEditorProps,
  BuilderInlinePluginRegistry,
  BuilderInlineRenderContext,
} from "../builder/inlinePlugin";
import {
  createBlockId,
  textInlineTypeId,
  type BuilderInlineNode,
} from "../model/document";
import { InlinePayloadEditor } from "./paragraphEditor";
import {
  createFootnoteInline,
  requireFootnote,
  type FootnoteInline,
} from "./footnoteModel";

function FootnoteInlineSequence({
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

export function FootnotePreview({
  inline,
  registry,
  context,
}: Readonly<{
  inline: BuilderInlineNode;
  registry: BuilderInlinePluginRegistry;
  context: BuilderInlineRenderContext;
}>) {
  const footnote = requireFootnote(inline);
  const ordinal = context.inlineOrdinals.get(footnote.id)?.ordinal;
  const plainText = footnote.inlines
    .map((nested) => registry.adapterForInline(nested).plainText(nested, registry))
    .join("");
  return (
    <span className="footnote-preview">
      <sup>
        <button
          type="button"
          aria-label={`Footnote ${ordinal === undefined ? "preview" : String(ordinal)}: ${plainText}`}
        >
          {ordinal ?? "?"}
        </button>
      </sup>
      <span className="footnote-preview__popover" role="note">
        <b>{ordinal ?? "?"}</b>
        <span>
          <FootnoteInlineSequence
            inlines={footnote.inlines}
            registry={registry}
            context={context}
          />
        </span>
      </span>
    </span>
  );
}

function replaceFootnoteInlines(
  footnote: FootnoteInline,
  inlines: readonly BuilderInlineNode[],
  onChange: (inline: BuilderInlineNode) => void,
): void {
  onChange(createFootnoteInline(inlines, footnote.id));
}

export function FootnoteEditor({
  inline,
  registry,
  onChange,
  context,
}: BuilderInlineEditorProps) {
  const footnote = requireFootnote(inline);
  const [newInlineType, setNewInlineType] = useState(textInlineTypeId);
  const availablePlugins = registry
    .palettePlugins()
    .filter((plugin) => plugin.numberingSeries !== "footnote");

  const move = (from: number, to: number): void => {
    if (to < 0 || to >= footnote.inlines.length) {
      return;
    }
    const moved = [...footnote.inlines];
    const [entry] = moved.splice(from, 1);
    if (entry !== undefined) {
      moved.splice(to, 0, entry);
      replaceFootnoteInlines(footnote, moved, onChange);
    }
  };

  return (
    <div className="footnote-editor">
      <div className="footnote-editor__preview">
        <span>Live footnote marker and hover preview</span>
        <FootnotePreview inline={footnote} registry={registry} context={context} />
      </div>
      <div className="footnote-editor__segments">
        {footnote.inlines.map((nested, index) => {
          const adapter = registry.adapterForInline(nested);
          return (
            <section
              className="footnote-editor__segment"
              data-footnote-inline-id={nested.id}
              key={nested.id}
            >
              <header>
                <strong>{adapter.palette.label}</strong>
                <code>{nested.typeId}</code>
                <button
                  type="button"
                  aria-label={`Move footnote segment ${String(index + 1)} left`}
                  disabled={index === 0}
                  onClick={() => {
                    move(index, index - 1);
                  }}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={`Move footnote segment ${String(index + 1)} right`}
                  disabled={index + 1 === footnote.inlines.length}
                  onClick={() => {
                    move(index, index + 1);
                  }}
                >
                  →
                </button>
                <button
                  type="button"
                  disabled={footnote.inlines.length === 1}
                  onClick={() => {
                    replaceFootnoteInlines(
                      footnote,
                      footnote.inlines.filter((candidate) => candidate.id !== nested.id),
                      onChange,
                    );
                  }}
                >
                  Remove
                </button>
              </header>
              <InlinePayloadEditor
                inline={nested}
                registry={registry}
                context={context}
                onChange={(replacement) => {
                  replaceFootnoteInlines(
                    footnote,
                    footnote.inlines.map((candidate) =>
                      candidate.id === nested.id ? replacement : candidate,
                    ),
                    onChange,
                  );
                }}
              />
            </section>
          );
        })}
      </div>
      <div className="footnote-editor__add">
        <select
          value={newInlineType}
          onChange={(event) => {
            setNewInlineType(event.target.value);
          }}
        >
          {availablePlugins.map((plugin) => (
            <option key={plugin.typeId} value={plugin.typeId}>
              {plugin.palette.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            const plugin = availablePlugins.find(
              (candidate) => candidate.typeId === newInlineType,
            );
            if (plugin !== undefined) {
              replaceFootnoteInlines(
                footnote,
                [...footnote.inlines, plugin.createDefault(createBlockId())],
                onChange,
              );
            }
          }}
        >
          Add footnote segment
        </button>
      </div>
    </div>
  );
}
