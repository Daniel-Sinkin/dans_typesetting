// Semantic Python-source plot contract; rendered assets remain writer-owned cache data.
import type { BuilderBlock } from "../model/document";

export const pythonPlotTypeId = "dans.plot.python";
export const pythonPlotRenderEndpoint = "/api/python-plot/render";
export const pythonPlotSourceMaximumBytes = 100_000;
export const pythonPlotExtentMinimum = 64;
export const pythonPlotExtentMaximum = 4096;

const utf8Encoder = new TextEncoder();

export function pythonPlotSourceByteLength(source: string): number {
  return utf8Encoder.encode(source).byteLength;
}

export interface PythonPlotBlock extends BuilderBlock {
  readonly typeId: typeof pythonPlotTypeId;
  readonly source: string;
  readonly widthFraction: number;
  readonly targetPixelWidth: number;
  readonly targetPixelHeight: number;
}

export const defaultPythonPlotSource = [
  "x = np.linspace(0.0, 2.0 * np.pi, 300)",
  "figure, axis = plt.subplots(layout=\"constrained\")",
  "axis.plot(x, np.sin(x), label=\"sin(x)\")",
  "axis.plot(x, np.cos(x), label=\"cos(x)\")",
  "axis.set_xlabel(\"x\")",
  "axis.set_ylabel(\"amplitude\")",
  "axis.set_title(\"Live Python / Matplotlib plot\")",
  "axis.grid(alpha=0.25)",
  "axis.legend()",
].join("\n");

function validExtent(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value >= pythonPlotExtentMinimum &&
    value <= pythonPlotExtentMaximum
  );
}

export function createPythonPlotBlock(
  id: string,
  source: string = defaultPythonPlotSource,
  widthFraction = 0.9,
  targetPixelWidth = 1280,
  targetPixelHeight = 720,
): PythonPlotBlock {
  const block = Object.freeze({
    id,
    typeId: pythonPlotTypeId,
    source,
    widthFraction,
    targetPixelWidth,
    targetPixelHeight,
  }) satisfies PythonPlotBlock;
  validatePythonPlotBlock(block);
  return block;
}

export function isPythonPlotBlock(block: BuilderBlock): block is PythonPlotBlock {
  return (
    block.typeId === pythonPlotTypeId &&
    "source" in block &&
    typeof block.source === "string" &&
    "widthFraction" in block &&
    typeof block.widthFraction === "number" &&
    "targetPixelWidth" in block &&
    typeof block.targetPixelWidth === "number" &&
    "targetPixelHeight" in block &&
    typeof block.targetPixelHeight === "number"
  );
}

export function requirePythonPlotBlock(block: BuilderBlock): PythonPlotBlock {
  if (!isPythonPlotBlock(block)) {
    throw new Error(`Python-plot plugin cannot consume ${block.typeId}`);
  }
  validatePythonPlotBlock(block);
  return block;
}

export function validatePythonPlotBlock(block: PythonPlotBlock): void {
  if (block.id.length === 0) {
    throw new Error("A Python plot requires a stable ID");
  }
  if (
    block.source.trim().length === 0 ||
    pythonPlotSourceByteLength(block.source) > pythonPlotSourceMaximumBytes
  ) {
    throw new Error(
      `Python plot source must contain between 1 and ${String(pythonPlotSourceMaximumBytes)} UTF-8 bytes`,
    );
  }
  if (
    !Number.isFinite(block.widthFraction) ||
    block.widthFraction <= 0 ||
    block.widthFraction > 1
  ) {
    throw new Error("Python plot widthFraction must be in (0, 1]");
  }
  if (
    !validExtent(block.targetPixelWidth) ||
    !validExtent(block.targetPixelHeight)
  ) {
    throw new Error(
      `Python plot target dimensions must be integers in [${String(pythonPlotExtentMinimum)}, ${String(pythonPlotExtentMaximum)}]`,
    );
  }
}
