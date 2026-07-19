// builder/src/builder/plugin.ts — define and validate graphical block plugin contracts.
import type { ReactNode } from "react";

import type { BuilderBlock, BuilderBlockEnvelope } from "../model/document";
import type {
  BuilderReferenceTarget,
  BuilderReferenceTargetDescriptor,
} from "./reference";

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
  readonly documentBlocks: readonly BuilderBlock[];
  readonly sectionDepth: number;
  readonly referenceTargets: ReadonlyMap<string, BuilderReferenceTarget>;
}

export interface BuilderBlockMeasureContext {
  readonly documentBlocks: readonly BuilderBlock[];
  readonly sectionDepth: number;
}

export type BuilderPaginationPolicy = "flow" | "page_break_after" | "isolated_page";

export interface BuilderBlockAdapter {
  readonly palette: PaletteDescriptor;
  readonly numberingSeries?: string | undefined;
  readonly paginationPolicy?: BuilderPaginationPolicy | undefined;
  readonly referenceTarget?:
    | ((block: BuilderBlock) => BuilderReferenceTargetDescriptor | null)
    | undefined;
  readonly copyForInsert?:
    | ((block: BuilderBlock, copiedBlockId: string) => BuilderBlock)
    | undefined;
  measure(
    block: BuilderBlock,
    availableWidth: number,
    context: BuilderBlockMeasureContext,
  ): number;
  renderPreview(block: BuilderBlock, context: BuilderBlockRenderContext): ReactNode;
}

export interface BuilderBlockEditorProps {
  readonly block: BuilderBlock;
  readonly onPreview: (block: BuilderBlock) => void;
  readonly onCommit: (block: BuilderBlock) => void;
  readonly onCancel: () => void;
  readonly referenceTargets: ReadonlyMap<string, BuilderReferenceTarget>;
}

export interface BuilderBlockEditor {
  readonly presentation?: "dialog" | "inline";
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
  readonly paginationPolicy?: BuilderPaginationPolicy | undefined;
  readonly referenceTarget?:
    | ((block: BuilderBlock) => BuilderReferenceTargetDescriptor | null)
    | undefined;
  readonly copyForInsert?:
    | ((block: BuilderBlock, copiedBlockId: string) => BuilderBlock)
    | undefined;
  measure(
    block: BuilderBlockEnvelope,
    availableWidth: number,
    context: BuilderBlockMeasureContext,
  ): number;
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
