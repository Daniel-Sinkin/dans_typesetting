// Lower scoped LaTeX-math source to a safe KaTeX preview result.
import katex from "katex";

import { latexMathSourceError } from "./latexMathModel";

export interface LatexMathRenderResult {
  readonly html: string | null;
  readonly error: string | null;
}

export function renderLatexMath(
  source: string,
  displayMode: boolean,
): LatexMathRenderResult {
  const sourceError = latexMathSourceError(source, !displayMode);
  if (sourceError !== null) {
    return { html: null, error: sourceError };
  }
  try {
    return {
      html: katex.renderToString(source, {
        displayMode,
        output: "htmlAndMathml",
        strict: "warn",
        throwOnError: true,
        trust: false,
      }),
      error: null,
    };
  } catch (error) {
    return {
      html: null,
      error: error instanceof Error ? error.message : "KaTeX could not render this source.",
    };
  }
}
