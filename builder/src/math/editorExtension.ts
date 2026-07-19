// Optional graphical authoring contributions for the structured-math editor.
import type { MathExpression } from "../model/math";

export interface MathEditorPaletteItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  create(): MathExpression;
}

export interface MathEditorExtension {
  readonly id: string;
  readonly label: string;
  readonly items: readonly MathEditorPaletteItem[];
}
