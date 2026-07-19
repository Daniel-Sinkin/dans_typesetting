// Compose plugin-owned rich captions through the graphical inline registry.
import { copyBuilderInlineForInsert } from "../builder/copyInline";
import type { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import type { BuilderInlineNode } from "../model/document";

export function richCaptionPlainText(
  inlines: readonly BuilderInlineNode[],
  registry: BuilderInlinePluginRegistry,
): string {
  return inlines
    .map((inline) => registry.adapterForInline(inline).plainText(inline, registry))
    .join("");
}

export function copyRichCaption(
  inlines: readonly BuilderInlineNode[],
  registry: BuilderInlinePluginRegistry,
): readonly BuilderInlineNode[] {
  return Object.freeze(
    inlines.map((inline) => copyBuilderInlineForInsert(inline, registry)),
  );
}
