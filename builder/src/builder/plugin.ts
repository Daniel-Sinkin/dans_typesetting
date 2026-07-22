// builder/src/builder/plugin.ts — define and validate graphical block plugin contracts.
import type { ReactNode } from "react";

import type { BuilderBlock, BuilderBlockEnvelope } from "../model/document";
import type {
  BuilderReferenceTarget,
  BuilderReferenceTargetDescriptor,
} from "./reference";
import type {
  BlockOrdinal,
  InlineOrdinal,
  NumberedBlockOccurrence,
  NumberedInlineOccurrence,
} from "./numbered";
import type {
  BuilderDocumentResourceDescriptor,
  BuilderDocumentResourceIndex,
} from "./documentResources";

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
  readonly inlineOrdinals: ReadonlyMap<string, InlineOrdinal>;
  readonly blockOrdinals: ReadonlyMap<string, BlockOrdinal>;
  readonly documentResources: BuilderDocumentResourceIndex;
  readonly childSequenceLayouts: readonly BuilderChildSequenceLayout[];
}

export interface BuilderBlockMeasureContext {
  readonly documentBlocks: readonly BuilderBlock[];
  readonly sectionDepth: number;
  measureChildSequence(sequenceId: string, availableWidth: number): number;
}

export interface BuilderChildSequencePlacement {
  readonly sequenceId: string;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
  readonly height?: number;
}

export interface BuilderChildSequenceLayout {
  readonly sequenceId: string;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
  readonly height: number;
}

export type BuilderPaginationPolicy = "flow" | "page_break_after" | "isolated_page";

export interface BuilderBlockAdapter {
  readonly palette: PaletteDescriptor;
  readonly numberingSeries?: string | undefined;
  readonly paginationPolicy?: BuilderPaginationPolicy | undefined;
  readonly referenceTarget?:
    | ((block: BuilderBlock) => BuilderReferenceTargetDescriptor | null)
    | undefined;
  readonly referenceTargets?:
    | ((block: BuilderBlock) => readonly BuilderReferenceTargetDescriptor[])
    | undefined;
  readonly copyForInsert?:
    | ((block: BuilderBlock, copiedBlockId: string) => BuilderBlock)
    | undefined;
  readonly numberedInlineOccurrences?:
    | ((block: BuilderBlock) => readonly NumberedInlineOccurrence[])
    | undefined;
  readonly numberedOccurrences?:
    | ((block: BuilderBlock) => readonly NumberedBlockOccurrence[])
    | undefined;
  readonly documentResources?:
    | ((block: BuilderBlock) => readonly BuilderDocumentResourceDescriptor[])
    | undefined;
  readonly layoutChildSequences?:
    | ((
        block: BuilderBlock,
        availableWidth: number,
        context: BuilderBlockMeasureContext,
      ) => readonly BuilderChildSequencePlacement[])
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
  readonly numberingSeries: string | null;
  readonly ordinal: number | null;
  readonly onPreview: (block: BuilderBlock) => void;
  readonly onCommit: (block: BuilderBlock) => void;
  readonly onCancel: () => void;
  readonly referenceTargets: ReadonlyMap<string, BuilderReferenceTarget>;
  readonly inlineOrdinals: ReadonlyMap<string, InlineOrdinal>;
  readonly blockOrdinals: ReadonlyMap<string, BlockOrdinal>;
  readonly documentResources: BuilderDocumentResourceIndex;
}

export interface BuilderBlockSourceEditor {
  fileName(block: BuilderBlock): string;
  source(block: BuilderBlock): string;
  applySource(block: BuilderBlock, source: string): BuilderBlock;
}

export interface BuilderBlockEditor {
  readonly presentation?: "dialog" | "inline";
  readonly sourceEditor?: BuilderBlockSourceEditor;
  title(block: BuilderBlock): string;
  render(props: BuilderBlockEditorProps): ReactNode;
  renderInline?(props: BuilderBlockEditorProps): ReactNode;
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
  readonly referenceTargets?:
    | ((block: BuilderBlock) => readonly BuilderReferenceTargetDescriptor[])
    | undefined;
  readonly copyForInsert?:
    | ((block: BuilderBlock, copiedBlockId: string) => BuilderBlock)
    | undefined;
  readonly numberedInlineOccurrences?:
    | ((block: BuilderBlock) => readonly NumberedInlineOccurrence[])
    | undefined;
  readonly numberedOccurrences?:
    | ((block: BuilderBlock) => readonly NumberedBlockOccurrence[])
    | undefined;
  readonly layoutChildSequences?:
    | ((
        block: BuilderBlockEnvelope,
        availableWidth: number,
        context: BuilderBlockMeasureContext,
      ) => readonly BuilderChildSequencePlacement[])
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

  public documentResourcesForBlock(
    block: BuilderBlock,
  ): readonly BuilderDocumentResourceDescriptor[] {
    return this.#plugins.get(block.typeId)?.documentResources?.(block) ?? [];
  }

  public numberedOccurrencesForBlock(
    block: BuilderBlock,
  ): readonly NumberedBlockOccurrence[] {
    const adapter = this.pluginForBlock(block);
    const occurrences = adapter.numberedOccurrences?.(block);
    if (occurrences !== undefined) {
      return occurrences;
    }
    return adapter.numberingSeries === undefined
      ? []
      : [{ occurrenceId: block.id, numberingSeries: adapter.numberingSeries }];
  }
}
