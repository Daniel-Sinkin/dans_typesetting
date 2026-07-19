// React views for the semantic paragraph colour-span extension.
import { Fragment } from "react";

import type {
  BuilderInlineEditorProps,
  BuilderInlinePluginRegistry,
} from "../builder/inlinePlugin";
import type { BuilderInlineNode } from "../model/document";
import {
  colorFromHex,
  colorToCss,
  colorToHex,
  requireColorSpan,
} from "./colorSpanModel";
import { InlinePayloadEditor } from "./paragraphEditor";

export function ColorSpanPreview({
  inline,
  registry,
}: Readonly<{
  inline: BuilderInlineNode;
  registry: BuilderInlinePluginRegistry;
}>) {
  const colorSpan = requireColorSpan(inline);
  return (
    <span className="inline-color-span" style={{ color: colorToCss(colorSpan.color) }}>
      {colorSpan.inlines.map((nestedInline) => (
        <Fragment key={nestedInline.id}>
          {registry.adapterForInline(nestedInline).renderPreview(nestedInline, registry)}
        </Fragment>
      ))}
    </span>
  );
}

export function ColorSpanEditor({ inline, registry, onChange }: BuilderInlineEditorProps) {
  const colorSpan = requireColorSpan(inline);

  return (
    <div className="color-span-editor">
      <label className="color-span-editor__color">
        <span>Text colour</span>
        <input
          data-color-span-id={colorSpan.id}
          type="color"
          value={colorToHex(colorSpan.color)}
          onChange={(event) => {
            onChange(
              Object.freeze({
                ...colorSpan,
                color: colorFromHex(event.target.value),
              }),
            );
          }}
        />
        <code>{colorToCss(colorSpan.color)}</code>
      </label>
      <div className="color-span-editor__content">
        <span>Nested inline content</span>
        {colorSpan.inlines.map((nestedInline, index) => (
          <div className="color-span-editor__nested" key={nestedInline.id}>
            <small>
              {registry.adapterForInline(nestedInline).palette.label} {index + 1}
            </small>
            <InlinePayloadEditor
              inline={nestedInline}
              registry={registry}
              onChange={(replacement) => {
                onChange(
                  Object.freeze({
                    ...colorSpan,
                    inlines: Object.freeze(
                      colorSpan.inlines.map((candidate) =>
                        candidate.id === nestedInline.id ? replacement : candidate,
                      ),
                    ),
                  }),
                );
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
