import { referenceIdPattern } from "../model/referenceId";
import type { BuilderReferenceTarget } from "./reference";

export function editableReferenceIdError(
  value: string,
  blockId: string,
  targets: ReadonlyMap<string, BuilderReferenceTarget>,
): string | null {
  if (value.length === 0) {
    return null;
  }
  if (!referenceIdPattern.test(value)) {
    return "Use a leading ASCII letter followed by letters, digits, '-', '_', '.', or ':'.";
  }
  const existing = targets.get(value);
  if (existing !== undefined && existing.blockId !== blockId) {
    return `${value} already identifies ${existing.displayText}.`;
  }
  return null;
}
