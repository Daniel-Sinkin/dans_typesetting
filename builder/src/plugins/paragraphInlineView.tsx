// React views for editable and opaque Core Paragraph inline nodes.
import type { BuilderInlineEditorProps } from "../builder/inlinePlugin";
import type { BuilderInlineNode } from "../model/document";
import { requireParagraphText } from "./paragraphInlineSupport";

export function ParagraphTextPreview({ inline }: Readonly<{ inline: BuilderInlineNode }>) {
  return <span>{requireParagraphText(inline).text}</span>;
}

export function ParagraphTextEditor({ inline, onChange }: BuilderInlineEditorProps) {
  const text = requireParagraphText(inline);
  return (
    <label className="inline-text-editor">
      <span>Text</span>
      <textarea
        data-inline-id={text.id}
        rows={3}
        value={text.text}
        onChange={(event) => {
          onChange(Object.freeze({ ...text, text: event.target.value }));
        }}
      />
    </label>
  );
}

export function OpaqueInlinePreview({ inline }: Readonly<{ inline: BuilderInlineNode }>) {
  return (
    <span className="inline-unsupported" title={inline.typeId}>
      <span>{inline.label ?? "Unsupported inline"}</span>
      <code>{inline.typeId}</code>
    </span>
  );
}
