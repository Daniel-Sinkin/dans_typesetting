// Derive namespaced plugin resources from one immutable document snapshot.
import { flattenBuilderBlocks, type BuilderBlock } from "../model/document";
import type { BuilderPluginRegistry } from "./plugin";

export interface BuilderDocumentResourceDescriptor {
  readonly namespace: string;
  readonly key: string;
  readonly value: unknown;
}

export interface BuilderDocumentResource extends BuilderDocumentResourceDescriptor {
  readonly blockId: string;
  readonly blockTypeId: string;
  readonly ordinal: number;
  readonly anchorId: string;
}

export type BuilderDocumentResourceIndex = ReadonlyMap<
  string,
  ReadonlyMap<string, BuilderDocumentResource>
>;

export function documentResourceAnchorId(namespace: string, key: string): string {
  return `dans-resource-${encodeURIComponent(namespace)}-${encodeURIComponent(key)}`;
}

export function deriveDocumentResources(
  blocks: readonly BuilderBlock[],
  registry: BuilderPluginRegistry,
): BuilderDocumentResourceIndex {
  const mutableIndex = new Map<string, Map<string, BuilderDocumentResource>>();
  const nextOrdinal = new Map<string, number>();

  for (const block of flattenBuilderBlocks(blocks)) {
    const descriptors = registry.documentResourcesForBlock(block);
    for (const descriptor of descriptors) {
      if (descriptor.namespace.length === 0 || descriptor.key.length === 0) {
        throw new Error("A document resource requires a namespace and key");
      }
      const namespace =
        mutableIndex.get(descriptor.namespace) ??
        new Map<string, BuilderDocumentResource>();
      const previous = namespace.get(descriptor.key);
      if (previous !== undefined) {
        throw new Error(
          `Duplicate document resource '${descriptor.namespace}:${descriptor.key}' on blocks ${previous.blockId} and ${block.id}`,
        );
      }
      const ordinal = (nextOrdinal.get(descriptor.namespace) ?? 0) + 1;
      nextOrdinal.set(descriptor.namespace, ordinal);
      namespace.set(
        descriptor.key,
        Object.freeze({
          ...descriptor,
          blockId: block.id,
          blockTypeId: block.typeId,
          ordinal,
          anchorId: documentResourceAnchorId(descriptor.namespace, descriptor.key),
        }),
      );
      mutableIndex.set(descriptor.namespace, namespace);
    }
  }

  return new Map<string, ReadonlyMap<string, BuilderDocumentResource>>(
    [...mutableIndex].map(([namespace, resources]) => [namespace, new Map(resources)]),
  );
}

export function resourcesInNamespace(
  index: BuilderDocumentResourceIndex,
  namespace: string,
): ReadonlyMap<string, BuilderDocumentResource> {
  return index.get(namespace) ?? new Map<string, BuilderDocumentResource>();
}
