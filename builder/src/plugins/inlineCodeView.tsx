// React views for semantic inline source code.
import type { BuilderInlineEditorProps } from "../builder/inlinePlugin";
import type { BuilderInlineNode } from "../model/document";
import { createInlineCode, requireInlineCode } from "./inlineCodeModel";

export function InlineCodePreview({
  inline,
}: Readonly<{ inline: BuilderInlineNode }>) {
  return <code className="inline-code-content">{requireInlineCode(inline).code}</code>;
}

export function InlineCodeEditor({ inline, onChange }: BuilderInlineEditorProps) {
  const inlineCode = requireInlineCode(inline);
  return (
    <label className="inline-code-editor">
      <span>Source code</span>
      <input
        data-inline-code-id={inlineCode.id}
        type="text"
        spellCheck={false}
        value={inlineCode.code}
        onChange={(event) => {
          onChange(createInlineCode(event.target.value, inlineCode.id));
        }}
      />
      <small>Inline code is one semantic source line; use a listing for multiline code.</small>
    </label>
  );
}
