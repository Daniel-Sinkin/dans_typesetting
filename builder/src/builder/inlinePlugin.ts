// Define graphical adapters for Core Paragraph's extensible inline-node contract.
import type { ReactNode } from "react";

import type { BuilderInlineNode } from "../model/document";
import type { PaletteDescriptor } from "./plugin";
import type { BuilderReferenceTarget } from "./reference";
import type { InlineOrdinal, NumberedInlineOccurrence } from "./numbered";

export interface BuilderInlineRenderContext {
  readonly referenceTargets: ReadonlyMap<string, BuilderReferenceTarget>;
  readonly inlineOrdinals: ReadonlyMap<string, InlineOrdinal>;
}

export interface BuilderInlineEditorProps {
  readonly inline: BuilderInlineNode;
  readonly registry: BuilderInlinePluginRegistry;
  readonly onChange: (inline: BuilderInlineNode) => void;
  readonly context: BuilderInlineRenderContext;
}

export interface BuilderInlineEditor {
  render(props: BuilderInlineEditorProps): ReactNode;
}

export interface BuilderInlineAdapter {
  readonly palette: PaletteDescriptor;
  readonly editor?: BuilderInlineEditor;
  readonly numberingSeries?: string | undefined;
  readonly nestedInlines?:
    | ((inline: BuilderInlineNode) => readonly BuilderInlineNode[])
    | undefined;
  readonly copyForInsert?:
    | ((
        inline: BuilderInlineNode,
        copiedInlineId: string,
        registry: BuilderInlinePluginRegistry,
      ) => BuilderInlineNode)
    | undefined;
  plainText(inline: BuilderInlineNode, registry: BuilderInlinePluginRegistry): string;
  renderPreview(
    inline: BuilderInlineNode,
    registry: BuilderInlinePluginRegistry,
    context: BuilderInlineRenderContext,
  ): ReactNode;
}

export interface BuilderInlinePlugin extends BuilderInlineAdapter {
  readonly typeId: string;
  createDefault(inlineId: string): BuilderInlineNode;
}

export type BuilderInlineFallbackAdapter = BuilderInlineAdapter;

export class BuilderInlinePluginRegistry {
  readonly #plugins = new Map<string, BuilderInlinePlugin>();
  readonly #fallbackAdapter: BuilderInlineFallbackAdapter;

  public constructor(
    plugins: readonly BuilderInlinePlugin[],
    fallbackAdapter: BuilderInlineFallbackAdapter,
  ) {
    this.#fallbackAdapter = fallbackAdapter;
    for (const plugin of plugins) {
      if (plugin.typeId.length === 0) {
        throw new Error("A builder inline plugin requires a semantic type ID");
      }
      if (this.#plugins.has(plugin.typeId)) {
        throw new Error(`Duplicate builder inline plugin type: ${plugin.typeId}`);
      }
      this.#plugins.set(plugin.typeId, plugin);
    }
  }

  public palettePlugins(): readonly BuilderInlinePlugin[] {
    return [...this.#plugins.values()];
  }

  public adapterForInline(inline: BuilderInlineNode): BuilderInlineAdapter {
    return this.#plugins.get(inline.typeId) ?? this.#fallbackAdapter;
  }

  public editorForInline(inline: BuilderInlineNode): BuilderInlineEditor | null {
    return this.#plugins.get(inline.typeId)?.editor ?? null;
  }

  public numberedOccurrences(
    roots: readonly BuilderInlineNode[],
  ): readonly NumberedInlineOccurrence[] {
    const result: NumberedInlineOccurrence[] = [];
    const seen = new Set<string>();
    const visit = (inlines: readonly BuilderInlineNode[]): void => {
      for (const inline of inlines) {
        if (seen.has(inline.id)) {
          throw new Error(`Duplicate or recursively reused inline ID: ${inline.id}`);
        }
        seen.add(inline.id);
        const adapter = this.adapterForInline(inline);
        const numberingSeries = adapter.numberingSeries;
        if (numberingSeries !== undefined) {
          if (numberingSeries.length === 0) {
            throw new Error("An inline numbering series cannot be empty");
          }
          result.push({ inlineId: inline.id, numberingSeries });
        }
        const nested = adapter.nestedInlines?.(inline);
        if (nested !== undefined) {
          visit(nested);
        }
      }
    };
    visit(roots);
    return result;
  }
}
