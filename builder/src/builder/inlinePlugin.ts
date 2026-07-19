// Define graphical adapters for Core Paragraph's extensible inline-node contract.
import type { ReactNode } from "react";

import type { BuilderInlineNode } from "../model/document";
import type { PaletteDescriptor } from "./plugin";

export interface BuilderInlineEditorProps {
  readonly inline: BuilderInlineNode;
  readonly registry: BuilderInlinePluginRegistry;
  readonly onChange: (inline: BuilderInlineNode) => void;
}

export interface BuilderInlineEditor {
  render(props: BuilderInlineEditorProps): ReactNode;
}

export interface BuilderInlineAdapter {
  readonly palette: PaletteDescriptor;
  readonly editor?: BuilderInlineEditor;
  plainText(inline: BuilderInlineNode, registry: BuilderInlinePluginRegistry): string;
  renderPreview(
    inline: BuilderInlineNode,
    registry: BuilderInlinePluginRegistry,
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
}
