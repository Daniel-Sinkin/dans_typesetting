// React views for clickable semantic hyperlinks and their inline labels.
import { Fragment, useState } from "react";

import type {
  BuilderInlineEditorProps,
  BuilderInlinePluginRegistry,
  BuilderInlineRenderContext,
} from "../builder/inlinePlugin";
import {
  createBlockId,
  paragraphTextInlineTypeId,
  type BuilderInlineNode,
} from "../model/document";
import { InlinePayloadEditor } from "./paragraphEditor";
import {
  browserHyperlinkTarget,
  requireHyperlink,
} from "./hyperlinkSupport";

export function HyperlinkPreview({
  inline,
  registry,
  context,
}: Readonly<{
  inline: BuilderInlineNode;
  registry: BuilderInlinePluginRegistry;
  context: BuilderInlineRenderContext;
}>) {
  const link = requireHyperlink(inline);
  return (
    <a
      className="inline-hyperlink"
      href={browserHyperlinkTarget(link.target)}
      target="_blank"
      rel="noreferrer"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      {link.labelInlines.length === 0
        ? link.target
        : link.labelInlines.map((labelInline) => (
            <Fragment key={labelInline.id}>
              {registry
                .adapterForInline(labelInline)
                .renderPreview(labelInline, registry, context)}
            </Fragment>
          ))}
    </a>
  );
}

export function HyperlinkEditor({
  inline,
  registry,
  onChange,
  context,
}: BuilderInlineEditorProps) {
  const link = requireHyperlink(inline);
  const [newLabelType, setNewLabelType] = useState(paragraphTextInlineTypeId);
  const availableLabelPlugins = registry
    .palettePlugins()
    .filter((plugin) => plugin.typeId !== link.typeId);

  const replaceLabel = (labelInlines: readonly BuilderInlineNode[]): void => {
    onChange(Object.freeze({ ...link, labelInlines: Object.freeze([...labelInlines]) }));
  };

  return (
    <div className="hyperlink-editor">
      <label className="editor-field">
        <span>Target</span>
        <input
          data-hyperlink-id={link.id}
          type="text"
          required
          value={link.target}
          onChange={(event) => {
            onChange(Object.freeze({ ...link, target: event.target.value }));
          }}
        />
      </label>
      <div className="hyperlink-editor__label-heading">
        <div>
          <strong>Visible label</strong>
          <small>An empty sequence displays the target itself.</small>
        </div>
        <button
          type="button"
          onClick={() => {
            replaceLabel([]);
          }}
        >
          Show target
        </button>
      </div>
      <div className="hyperlink-editor__labels">
        {link.labelInlines.map((labelInline, index) => (
          <section key={labelInline.id} className="hyperlink-editor__label">
            <header>
              <strong>{registry.adapterForInline(labelInline).palette.label}</strong>
              <span>{index + 1}</span>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => {
                  const labels = [...link.labelInlines];
                  const [moved] = labels.splice(index, 1);
                  if (moved !== undefined) {
                    labels.splice(index - 1, 0, moved);
                    replaceLabel(labels);
                  }
                }}
              >
                Up
              </button>
              <button
                type="button"
                disabled={index + 1 === link.labelInlines.length}
                onClick={() => {
                  const labels = [...link.labelInlines];
                  const [moved] = labels.splice(index, 1);
                  if (moved !== undefined) {
                    labels.splice(index + 1, 0, moved);
                    replaceLabel(labels);
                  }
                }}
              >
                Down
              </button>
              <button
                type="button"
                onClick={() => {
                  replaceLabel(
                    link.labelInlines.filter(
                      (candidate) => candidate.id !== labelInline.id,
                    ),
                  );
                }}
              >
                Remove
              </button>
            </header>
            <InlinePayloadEditor
              inline={labelInline}
              registry={registry}
              context={context}
              onChange={(replacement) => {
                replaceLabel(
                  link.labelInlines.map((candidate) =>
                    candidate.id === labelInline.id ? replacement : candidate,
                  ),
                );
              }}
            />
          </section>
        ))}
      </div>
      <div className="hyperlink-editor__add">
        <select
          value={newLabelType}
          onChange={(event) => {
            setNewLabelType(event.target.value);
          }}
        >
          {availableLabelPlugins.map((plugin) => (
            <option key={plugin.typeId} value={plugin.typeId}>
              {plugin.palette.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            const plugin = availableLabelPlugins.find(
              (candidate) => candidate.typeId === newLabelType,
            );
            if (plugin !== undefined) {
              replaceLabel([...link.labelInlines, plugin.createDefault(createBlockId())]);
            }
          }}
        >
          Add label segment
        </button>
      </div>
    </div>
  );
}
