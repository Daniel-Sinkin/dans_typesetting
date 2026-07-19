// Stable semantic IDs shared by reference-producing and reference-consuming plugins.
export const referenceIdPattern = /^[A-Za-z][A-Za-z0-9_.:-]*$/u;

export function validateOptionalReferenceId(
  referenceId: string | null,
  context: string,
): void {
  if (referenceId !== null && !referenceIdPattern.test(referenceId)) {
    throw new Error(
      `${context} must begin with an ASCII letter and contain only letters, digits, '-', '_', '.', and ':'`,
    );
  }
}

export function decodeOptionalReferenceId(
  value: unknown,
  context: string,
): string | null {
  // Missing fields are accepted as null for payloads written before targets
  // were added to figures, equations, and listings.
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${context} must be a string or null`);
  }
  validateOptionalReferenceId(value, context);
  return value;
}

export function requireReferenceId(value: string, context: string): string {
  validateOptionalReferenceId(value, context);
  if (value.length === 0) {
    throw new Error(`${context} cannot be empty`);
  }
  return value;
}
