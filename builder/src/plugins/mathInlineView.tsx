// React views for structured inline mathematics.
import type { BuilderInlineEditorProps } from "../builder/inlinePlugin";
import type { MathInputParserPlugin } from "../math/inputParser";
import type { MathEditorExtension } from "../math/editorExtension";
import type { BuilderInlineNode } from "../model/document";
import { MathExpressionEditor, MathTree } from "./math";
import { requireInlineMath } from "./mathInlineSupport";

export function InlineMathPreview({
  inline,
}: Readonly<{ inline: BuilderInlineNode }>) {
  const math = requireInlineMath(inline);
  return (
    <span className="math-inline-content" data-inline-math-id={math.id}>
      <MathTree expression={math.expression} />
    </span>
  );
}

interface InlineMathEditorProps extends BuilderInlineEditorProps {
  readonly inputParser?: MathInputParserPlugin | undefined;
  readonly editorExtensions?: readonly MathEditorExtension[] | undefined;
}

export function InlineMathEditor({
  inline,
  onChange,
  inputParser,
  editorExtensions,
}: InlineMathEditorProps) {
  const math = requireInlineMath(inline);
  return (
    <div className="inline-math-editor">
      <MathExpressionEditor
        expression={math.expression}
        inputParser={inputParser}
        editorExtensions={editorExtensions}
        saveLabel="Apply inline math"
        onCancel={() => undefined}
        onCommit={(expression) => {
          onChange(Object.freeze({ ...math, expression }));
        }}
      />
    </div>
  );
}
