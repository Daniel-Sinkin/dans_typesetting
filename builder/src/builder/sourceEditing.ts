/** Keep local scratch buffers portable without constraining canonical block IDs. */
export function sourceBufferFileName(blockId: string, extension: string): string {
  if (!/^[a-z0-9]{1,12}$/iu.test(extension)) {
    throw new Error("Source-buffer extensions must be short alphanumeric values");
  }
  const portableStem = blockId
    .replace(/[^a-z0-9._-]/giu, "-")
    .replace(/^[^a-z0-9]+/iu, "")
    .slice(0, 96);
  return `${portableStem.length === 0 ? "block" : portableStem}.${extension}`;
}
