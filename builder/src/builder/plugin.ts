// builder/src/builder/plugin.ts — define and validate graphical block plugin contracts.
import type { ReactNode } from "react";

import type { BuilderBlock, BuilderBlockEnvelope } from "../model/document";

export interface PaletteDescriptor {
  readonly label: string;
  readonly description: string;
  readonly glyph: string;
  readonly accentColor: string;
}

export interface BuilderBlockRenderContext {
  readonly documentIndex: number;
  readonly numberingSeries: string | null;
  readonly ordinal: number | null;
}

export interface BuilderBlockAdapter {
  readonly palette: PaletteDescriptor;
  readonly numberingSeries?: string | undefined;
  measure(block: BuilderBlock, availableWidth: number): number;
  renderPreview(block: BuilderBlock, context: BuilderBlockRenderContext): ReactNode;
}

export interface BuilderBlockEditorProps {
  readonly block: BuilderBlock;
  readonly onCommit: (block: BuilderBlock) => void;
  readonly onCancel: () => void;
}

export interface BuilderBlockEditor {
  title(block: BuilderBlock): string;
  render(props: BuilderBlockEditorProps): ReactNode;
}

export interface BuilderBlockPlugin extends BuilderBlockAdapter {
  readonly typeId: string;
  readonly editor?: BuilderBlockEditor;
  createDefault(blockId: string): BuilderBlock;
}

export interface BuilderFallbackAdapter {
  readonly palette: PaletteDescriptor;
  readonly numberingSeries?: string | undefined;
  measure(block: BuilderBlockEnvelope, availableWidth: number): number;
  renderPreview(block: BuilderBlockEnvelope, context: BuilderBlockRenderContext): ReactNode;
}

export type ResolvedBuilderAdapter = BuilderBlockAdapter | BuilderFallbackAdapter;

export class BuilderPluginRegistry {
  readonly #plugins = new Map<string, BuilderBlockPlugin>();
  readonly #fallbackAdapter: BuilderFallbackAdapter;

  public constructor(
    plugins: readonly BuilderBlockPlugin[],
    fallbackAdapter: BuilderFallbackAdapter,
  ) {
    this.#fallbackAdapter = fallbackAdapter;
    for (const plugin of plugins) {
      if (this.#plugins.has(plugin.typeId)) {
        throw new Error(`Duplicate builder plugin type: ${plugin.typeId}`);
      }
      this.#plugins.set(plugin.typeId, plugin);
    }
  }

  public palettePlugins(): readonly BuilderBlockPlugin[] {
    return [...this.#plugins.values()];
  }

  public pluginForBlock(block: BuilderBlock): ResolvedBuilderAdapter {
    return this.#plugins.get(block.typeId) ?? this.#fallbackAdapter;
  }

  public editorForBlock(block: BuilderBlock): BuilderBlockEditor | null {
    return this.#plugins.get(block.typeId)?.editor ?? null;
  }
}
