// React views for editable and opaque Core Paragraph inline nodes.
import type { BuilderInlineEditorProps } from "../builder/inlinePlugin";
import type { BuilderInlineNode } from "../model/document";
import { requireParagraphText } from "./paragraphInlineSupport";

export function ParagraphTextPreview({ inline }: Readonly<{ inline: BuilderInlineNode }>) {
  const text = requireParagraphText(inline);
  switch (text.style) {
    case "normal":
      return <span>{text.text}</span>;
    case "bold":
      return <strong>{text.text}</strong>;
    case "italic":
      return <em>{text.text}</em>;
    case "bold_italic":
      return (
        <strong>
          <em>{text.text}</em>
        </strong>
      );
  }
}

export function ParagraphTextEditor({ inline, onChange }: BuilderInlineEditorProps) {
  const text = requireParagraphText(inline);
  return (
    <div className="inline-text-editor">
      <label>
        <span>Style</span>
        <select
          data-inline-style-id={text.id}
          value={text.style}
          onChange={(event) => {
            const style = event.target.value;
            if (
              style === "normal" ||
              style === "bold" ||
              style === "italic" ||
              style === "bold_italic"
            ) {
              onChange(Object.freeze({ ...text, style }));
            }
          }}
        >
          <option value="normal">Normal</option>
          <option value="bold">Bold</option>
          <option value="italic">Italic</option>
          <option value="bold_italic">Bold italic</option>
        </select>
      </label>
      <label>
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
    </div>
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
