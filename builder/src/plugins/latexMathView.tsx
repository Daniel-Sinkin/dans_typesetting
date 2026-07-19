// Preview and text-edit source-authored LaTeX mathematics through KaTeX.
import { useState } from "react";

import type { BuilderInlineEditorProps } from "../builder/inlinePlugin";
import type { BuilderInlineNode } from "../model/document";
import {
  latexMathSourceError,
  requireLatexMathInline,
} from "./latexMathModel";
import { renderLatexMath } from "./latexMathRendering";

export function LatexMathPreview({
  source,
  displayMode,
}: Readonly<{ source: string; displayMode: boolean }>) {
  const rendered = renderLatexMath(source, displayMode);
  if (rendered.html === null) {
    return (
      <span className="latex-math-error" role="status">
        <code>{source.length === 0 ? "empty math" : source}</code>
        <small>{rendered.error}</small>
      </span>
    );
  }
  return (
    <span
      className={displayMode ? "latex-math-render latex-math-render--display" : "latex-math-render"}
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  );
}

export function LatexMathInlinePreview({
  inline,
}: Readonly<{ inline: BuilderInlineNode }>) {
  const math = requireLatexMathInline(inline);
  return (
    <span className="latex-math-inline" data-latex-math-inline-id={math.id}>
      <LatexMathPreview source={math.source} displayMode={false} />
    </span>
  );
}

export function LatexMathInlineEditor({ inline, onChange }: BuilderInlineEditorProps) {
  const math = requireLatexMathInline(inline);
  const [source, setSource] = useState(math.source);
  const sourceError = latexMathSourceError(source, true);

  return (
    <div className="latex-math-source-editor">
      <div className="latex-math-source-editor__preview">
        <span>Implicit $</span>
        <LatexMathPreview source={source} displayMode={false} />
        <span>$</span>
      </div>
      <label>
        <span>LaTeX math source</span>
        <textarea
          data-latex-math-inline-source={math.id}
          rows={3}
          value={source}
          spellCheck={false}
          onChange={(event) => {
            const nextSource = event.target.value;
            setSource(nextSource);
            if (latexMathSourceError(nextSource, true) === null) {
              onChange(Object.freeze({ ...math, source: nextSource }));
            }
          }}
        />
      </label>
      <small className={sourceError === null ? "field-status" : "field-error"}>
        {sourceError ?? "Write only the content inside the implicit math delimiters."}
      </small>
    </div>
  );
}
