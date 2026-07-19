// Optional capability consumed by the structured-math graphical editor.
import type { MathExpression } from "../model/math";

export interface MathInputParserPlugin {
  readonly typeId: string;
  readonly label: string;
  parse(source: string): MathExpression;
}
