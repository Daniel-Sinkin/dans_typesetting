// Deterministic recursive document flow for continuous, paged, and slide surfaces.
import type {
  BuilderBlockMeasureContext,
  BuilderPluginRegistry,
} from "./plugin";
import {
  childBlockSequences,
  isSectionBlock,
  sectionBody,
  sectionBodySequenceId,
  type BuilderBlock,
} from "../model/document";

export interface LayoutBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type DocumentLayoutMode = "continuous" | "paged" | "slides";

export interface PageRange {
  readonly start: number;
  readonly end: number;
}

export interface DocumentSurfaceGeometry {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly minimumHeight: number;
  readonly contentInsetX: number;
  readonly contentInsetTop: number;
  readonly contentInsetBottom: number;
  readonly blockGap: number;
  readonly pageGap: number;
  readonly sectionIndent: number;
  readonly maximumVisiblePages: number;
}

export const pageGeometry: DocumentSurfaceGeometry = Object.freeze({
  x: 0,
  y: 0,
  width: 794,
  minimumHeight: 1123,
  contentInsetX: 76,
  contentInsetTop: 88,
  contentInsetBottom: 92,
  blockGap: 26,
  pageGap: 58,
  sectionIndent: 30,
  maximumVisiblePages: 5,
});

export const slideGeometry: DocumentSurfaceGeometry = Object.freeze({
  x: 0,
  y: 0,
  width: 1280,
  minimumHeight: 720,
  contentInsetX: 72,
  contentInsetTop: 64,
  contentInsetBottom: 64,
  blockGap: 22,
  pageGap: 64,
  sectionIndent: 34,
  maximumVisiblePages: 5,
});

export function geometryForLayoutMode(
  mode: DocumentLayoutMode,
): DocumentSurfaceGeometry {
  return mode === "slides" ? slideGeometry : pageGeometry;
}

export interface BlockLayout {
  readonly block: BuilderBlock;
  readonly bounds: LayoutBounds;
  readonly parentId: string | null;
  readonly parentSequenceId: string | null;
  readonly siblingIndex: number;
  readonly depth: number;
  readonly pageIndex: number;
  readonly oversized: boolean;
}

export interface BlockInsertionTarget {
  readonly parentId: string | null;
  readonly parentSequenceId: string | null;
  readonly index: number;
}

export interface InsertionPreview {
  readonly parentId?: string | null;
  readonly parentSequenceId?: string | null;
  readonly index: number;
  readonly block: BuilderBlock;
}

export interface PageLayout {
  readonly pageIndex: number;
  readonly bounds: LayoutBounds;
  readonly contentBounds: LayoutBounds;
  readonly visible: boolean;
}

interface InsertionSlot extends BlockInsertionTarget {
  readonly depth: number;
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
}

export interface DocumentLayoutOptions {
  readonly mode?: DocumentLayoutMode;
  readonly pageRange?: PageRange;
}

export interface DocumentLayout {
  readonly mode: DocumentLayoutMode;
  readonly pageBounds: LayoutBounds;
  readonly contentBounds: LayoutBounds;
  readonly pages: readonly PageLayout[];
  readonly totalPageCount: number;
  readonly visiblePageRange: PageRange;
  readonly documentBlocks: readonly BuilderBlock[];
  readonly blocks: readonly BlockLayout[];
  readonly previewBounds: LayoutBounds | null;
  readonly previewPageIndex: number | null;
  readonly insertionSlots: readonly InsertionSlot[];
}

interface MutablePage {
  readonly pageIndex: number;
  readonly bounds: LayoutBounds;
  readonly contentBounds: LayoutBounds;
}

function pageAt(
  pageIndex: number,
  geometry: DocumentSurfaceGeometry,
): MutablePage {
  const x = geometry.x + pageIndex * (geometry.width + geometry.pageGap);
  return {
    pageIndex,
    bounds: {
      x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.minimumHeight,
    },
    contentBounds: {
      x: x + geometry.contentInsetX,
      y: geometry.y + geometry.contentInsetTop,
      width: geometry.width - 2 * geometry.contentInsetX,
      height:
        geometry.minimumHeight - geometry.contentInsetTop - geometry.contentInsetBottom,
    },
  };
}

function normalizeVisibleRange(
  totalPageCount: number,
  maximumVisiblePages: number,
  requested?: PageRange,
): PageRange {
  const requestedStart = requested?.start ?? 1;
  const start = Math.min(totalPageCount, Math.max(1, Math.trunc(requestedStart)));
  const requestedEnd = requested?.end ?? start;
  const end = Math.min(
    totalPageCount,
    start + maximumVisiblePages - 1,
    Math.max(start, Math.trunc(requestedEnd)),
  );
  return { start, end };
}

export function computeDocumentLayout(
  blocks: readonly BuilderBlock[],
  registry: BuilderPluginRegistry,
  preview: InsertionPreview | null = null,
  options: DocumentLayoutOptions = {},
): DocumentLayout {
  const mode = options.mode ?? "continuous";
  const geometry = geometryForLayoutMode(mode);
  const paginated = mode !== "continuous";
  const pages: MutablePage[] = [pageAt(0, geometry)];
  const blockLayouts: BlockLayout[] = [];
  const insertionSlots: InsertionSlot[] = [];
  let currentPageIndex = 0;
  let cursorY = pages[0]?.contentBounds.y ?? geometry.contentInsetTop;
  let previewBounds: LayoutBounds | null = null;
  let previewPageIndex: number | null = null;
  let previewWasPlaced = preview === null;

  const sequenceWithPreview = (
    sequence: readonly BuilderBlock[],
    parentId: string,
    parentSequenceId: string,
  ): readonly BuilderBlock[] => {
    if (
      preview === null ||
      (preview.parentId ?? null) !== parentId ||
      (preview.parentSequenceId ?? null) !== parentSequenceId
    ) {
      return sequence;
    }
    if (preview.index < 0 || preview.index > sequence.length) {
      throw new RangeError("The insertion preview targets an invalid child-sequence index");
    }
    const result = [...sequence];
    result.splice(preview.index, 0, preview.block);
    return result;
  };

  function measureSequenceHeight(
    sequence: readonly BuilderBlock[],
    parentId: string,
    parentSequenceId: string,
    availableWidth: number,
    sectionDepth: number,
  ): number {
    const measuredBlocks = sequenceWithPreview(sequence, parentId, parentSequenceId);
    let height = 0;
    for (const [index, block] of measuredBlocks.entries()) {
      if (index > 0) {
        height += geometry.blockGap;
      }
      height += measureBlockHeight(block, availableWidth, sectionDepth);
      if (isSectionBlock(block)) {
        const childWidth = availableWidth - geometry.sectionIndent;
        if (childWidth <= 0) {
          throw new Error("Nested section indentation exhausted the available document width");
        }
        const bodyHeight = measureSequenceHeight(
          sectionBody(block),
          block.id,
          sectionBodySequenceId,
          childWidth,
          sectionDepth + 1,
        );
        if (bodyHeight > 0) {
          height += geometry.blockGap + bodyHeight;
        }
      }
    }
    return height;
  }

  function measureContextForBlock(
    block: BuilderBlock,
    sectionDepth: number,
  ): BuilderBlockMeasureContext {
    return {
      documentBlocks: blocks,
      sectionDepth,
      measureChildSequence(sequenceId, availableWidth) {
        if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
          throw new Error("A child block sequence requires a positive available width");
        }
        const sequence = childBlockSequences(block).find(
          (candidate) => candidate.id === sequenceId,
        );
        if (sequence === undefined) {
          throw new Error(`Block ${block.id} does not expose child sequence ${sequenceId}`);
        }
        return measureSequenceHeight(
          sequence.blocks,
          block.id,
          sequence.id,
          availableWidth,
          sectionDepth,
        );
      },
    };
  }

  function measureBlockHeight(
    block: BuilderBlock,
    availableWidth: number,
    sectionDepth: number,
  ): number {
    const measuredHeight = registry
      .pluginForBlock(block)
      .measure(
        block,
        availableWidth,
        measureContextForBlock(block, sectionDepth),
      );
    if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) {
      throw new Error(`Builder adapter for ${block.typeId} returned an invalid block height`);
    }
    return measuredHeight;
  }

  const ensurePage = (pageIndex: number): MutablePage => {
    while (pages.length <= pageIndex) {
      pages.push(pageAt(pages.length, geometry));
    }
    const page = pages[pageIndex];
    if (page === undefined) {
      throw new Error(`Could not allocate document page ${String(pageIndex + 1)}`);
    }
    return page;
  };

  const advancePage = (): void => {
    currentPageIndex += 1;
    cursorY = ensurePage(currentPageIndex).contentBounds.y;
  };

  const place = (
    block: BuilderBlock,
    parentId: string | null,
    parentSequenceId: string | null,
    siblingIndex: number,
    depth: number,
    isPreview: boolean,
  ): BlockLayout => {
    const adapter = registry.pluginForBlock(block);
    const paginationPolicy = adapter.paginationPolicy ?? "flow";
    if (
      paginated &&
      paginationPolicy === "isolated_page" &&
      cursorY > ensurePage(currentPageIndex).contentBounds.y
    ) {
      advancePage();
    }

    let page = ensurePage(currentPageIndex);
    const indentation = depth * geometry.sectionIndent;
    const availableWidth = page.contentBounds.width - indentation;
    if (availableWidth <= 0) {
      throw new Error("Nested section indentation exhausted the available document width");
    }
    const measuredHeight = measureBlockHeight(block, availableWidth, depth);

    const oversized = paginated && measuredHeight > page.contentBounds.height;
    const height = oversized ? Math.min(180, page.contentBounds.height) : measuredHeight;
    if (
      paginated &&
      cursorY > page.contentBounds.y &&
      cursorY + height > page.contentBounds.y + page.contentBounds.height
    ) {
      advancePage();
      page = ensurePage(currentPageIndex);
    }

    const bounds = {
      x: page.contentBounds.x + indentation,
      y: cursorY,
      width: page.contentBounds.width - indentation,
      height,
    };
    const result: BlockLayout = {
      block,
      bounds,
      parentId,
      parentSequenceId,
      siblingIndex,
      depth,
      pageIndex: currentPageIndex,
      oversized,
    };
    cursorY += height + geometry.blockGap;

    if (isPreview) {
      previewBounds = bounds;
      previewPageIndex = currentPageIndex;
      previewWasPlaced = true;
    } else {
      blockLayouts.push(result);
      if (!oversized) {
        layoutContainedChildSequences(result);
      }
    }

    if (paginated && paginationPolicy !== "flow") {
      advancePage();
    }
    return result;
  };

  const recordSlot = (
    parentId: string | null,
    parentSequenceId: string | null,
    index: number,
    depth: number,
    pageIndex = currentPageIndex,
    y = cursorY,
  ): void => {
    const page = ensurePage(pageIndex);
    insertionSlots.push({
      parentId,
      parentSequenceId,
      index,
      depth,
      pageIndex,
      x: page.contentBounds.x + depth * geometry.sectionIndent,
      y,
    });
  };

  function layoutContainedSequence(
    sequence: readonly BuilderBlock[],
    parentId: string,
    parentSequenceId: string,
    x: number,
    startY: number,
    availableWidth: number,
    sectionDepth: number,
    pageIndex: number,
  ): number {
    let localCursorY = startY;

    const placeContainedBlock = (
      block: BuilderBlock,
      siblingIndex: number,
      isPreview: boolean,
    ): LayoutBounds => {
      const adapter = registry.pluginForBlock(block);
      if ((adapter.paginationPolicy ?? "flow") !== "flow") {
        throw new Error(
          `Contained child sequence ${parentId}/${parentSequenceId} cannot host pagination block ${block.typeId}`,
        );
      }
      const height = measureBlockHeight(block, availableWidth, sectionDepth);
      const bounds = {
        x,
        y: localCursorY,
        width: availableWidth,
        height,
      };
      const result: BlockLayout = {
        block,
        bounds,
        parentId,
        parentSequenceId,
        siblingIndex,
        depth: sectionDepth,
        pageIndex,
        oversized: false,
      };
      localCursorY += height + geometry.blockGap;

      if (isPreview) {
        previewBounds = bounds;
        previewPageIndex = pageIndex;
        previewWasPlaced = true;
      } else {
        blockLayouts.push(result);
        layoutContainedChildSequences(result);
      }

      if (!isPreview && isSectionBlock(block)) {
        const childWidth = availableWidth - geometry.sectionIndent;
        if (childWidth <= 0) {
          throw new Error("Nested section indentation exhausted the available document width");
        }
        localCursorY = layoutContainedSequence(
          sectionBody(block),
          block.id,
          sectionBodySequenceId,
          x + geometry.sectionIndent,
          localCursorY,
          childWidth,
          sectionDepth + 1,
          pageIndex,
        );
      }
      return bounds;
    };

    for (let index = 0; index <= sequence.length; index += 1) {
      if (
        preview !== null &&
        (preview.parentId ?? null) === parentId &&
        (preview.parentSequenceId ?? null) === parentSequenceId &&
        preview.index === index
      ) {
        placeContainedBlock(preview.block, index, true);
      }

      const block = sequence[index];
      if (block === undefined) {
        insertionSlots.push({
          parentId,
          parentSequenceId,
          index,
          depth: sectionDepth,
          pageIndex,
          x,
          y: localCursorY,
        });
        continue;
      }
      const bounds = placeContainedBlock(block, index, false);
      insertionSlots.push({
        parentId,
        parentSequenceId,
        index,
        depth: sectionDepth,
        pageIndex,
        x,
        y: bounds.y,
      });
    }
    return localCursorY;
  }

  function layoutContainedChildSequences(parent: BlockLayout): void {
    if (isSectionBlock(parent.block)) {
      return;
    }
    const sequences = childBlockSequences(parent.block);
    if (sequences.length === 0) {
      return;
    }
    const adapter = registry.pluginForBlock(parent.block);
    if (adapter.layoutChildSequences === undefined) {
      throw new Error(
        `Nested block adapter ${parent.block.typeId} does not place its child sequences`,
      );
    }
    const context = measureContextForBlock(parent.block, parent.depth);
    const placements = adapter.layoutChildSequences(
      parent.block,
      parent.bounds.width,
      context,
    );
    const placedSequenceIds = new Set<string>();
    for (const placement of placements) {
      if (placedSequenceIds.has(placement.sequenceId)) {
        throw new Error(
          `Nested block adapter ${parent.block.typeId} placed child sequence ${placement.sequenceId} twice`,
        );
      }
      placedSequenceIds.add(placement.sequenceId);
      const sequence = sequences.find(
        (candidate) => candidate.id === placement.sequenceId,
      );
      if (sequence === undefined) {
        throw new Error(
          `Nested block adapter ${parent.block.typeId} placed unknown child sequence ${placement.sequenceId}`,
        );
      }
      if (
        !Number.isFinite(placement.offsetX) ||
        !Number.isFinite(placement.offsetY) ||
        !Number.isFinite(placement.width) ||
        placement.offsetX < 0 ||
        placement.offsetY < 0 ||
        placement.width <= 0 ||
        placement.offsetX + placement.width > parent.bounds.width
      ) {
        throw new Error(
          `Nested block adapter ${parent.block.typeId} returned invalid child-sequence bounds`,
        );
      }
      const childHeight = context.measureChildSequence(
        sequence.id,
        placement.width,
      );
      if (placement.offsetY + childHeight > parent.bounds.height + 0.001) {
        throw new Error(
          `Nested block adapter ${parent.block.typeId} placed child sequence outside its block`,
        );
      }
      layoutContainedSequence(
        sequence.blocks,
        parent.block.id,
        sequence.id,
        parent.bounds.x + placement.offsetX,
        parent.bounds.y + placement.offsetY,
        placement.width,
        parent.depth,
        parent.pageIndex,
      );
    }
    if (placedSequenceIds.size !== sequences.length) {
      throw new Error(
        `Nested block adapter ${parent.block.typeId} did not place every child sequence`,
      );
    }
  }

  const layoutSequence = (
    sequence: readonly BuilderBlock[],
    parentId: string | null,
    parentSequenceId: string | null,
    depth: number,
  ): void => {
    for (let index = 0; index <= sequence.length; index += 1) {
      if (
        preview !== null &&
        (preview.parentId ?? null) === parentId &&
        (preview.parentSequenceId ?? null) === parentSequenceId &&
        preview.index === index
      ) {
        place(preview.block, parentId, parentSequenceId, index, depth, true);
      }

      const block = sequence[index];
      if (block === undefined) {
        recordSlot(parentId, parentSequenceId, index, depth);
        continue;
      }

      const layout = place(block, parentId, parentSequenceId, index, depth, false);
      recordSlot(
        parentId,
        parentSequenceId,
        index,
        depth,
        layout.pageIndex,
        layout.bounds.y,
      );
      if (isSectionBlock(block)) {
        layoutSequence(
          sectionBody(block),
          block.id,
          sectionBodySequenceId,
          depth + 1,
        );
      }
    }
  };

  layoutSequence(blocks, null, null, 0);
  if (!previewWasPlaced) {
    throw new RangeError("The insertion preview targets an unknown section or sequence index");
  }

  if (mode === "continuous") {
    const requiredBottom = Math.max(
      geometry.minimumHeight,
      cursorY - geometry.blockGap + geometry.contentInsetBottom,
    );
    const continuousPage = pages[0];
    if (continuousPage === undefined) {
      throw new Error("Continuous layout did not allocate its document surface");
    }
    pages.splice(0, pages.length, {
      ...continuousPage,
      bounds: { ...continuousPage.bounds, height: requiredBottom },
      contentBounds: {
        ...continuousPage.contentBounds,
        height:
          requiredBottom - geometry.contentInsetTop - geometry.contentInsetBottom,
      },
    });
  }

  const totalPageCount = pages.length;
  const visiblePageRange =
    mode === "continuous"
      ? { start: 1, end: 1 }
      : normalizeVisibleRange(
          totalPageCount,
          geometry.maximumVisiblePages,
          options.pageRange,
        );
  const pageLayouts = pages.map<PageLayout>((page) => ({
    ...page,
    visible:
      page.pageIndex + 1 >= visiblePageRange.start &&
      page.pageIndex + 1 <= visiblePageRange.end,
  }));
  const visiblePages = pageLayouts.filter((page) => page.visible);
  const firstPage = visiblePages[0];
  const lastPage = visiblePages.at(-1);
  if (firstPage === undefined || lastPage === undefined) {
    throw new Error("A document layout must expose at least one visible page");
  }
  const pageBounds = {
    x: firstPage.bounds.x,
    y: firstPage.bounds.y,
    width: lastPage.bounds.x + lastPage.bounds.width - firstPage.bounds.x,
    height: Math.max(...visiblePages.map((page) => page.bounds.height)),
  };

  return {
    mode,
    pageBounds,
    contentBounds: pageBounds,
    pages: pageLayouts,
    totalPageCount,
    visiblePageRange,
    documentBlocks: blocks,
    blocks: blockLayouts,
    previewBounds,
    previewPageIndex,
    insertionSlots,
  };
}

export function insertionTargetAtScenePoint(
  sceneX: number,
  sceneY: number,
  layout: DocumentLayout,
): BlockInsertionTarget {
  const visiblePageIndices = new Set(
    layout.pages.filter((page) => page.visible).map((page) => page.pageIndex),
  );
  const candidates = layout.insertionSlots.filter((slot) =>
    visiblePageIndices.has(slot.pageIndex),
  );
  const closest = candidates.reduce<InsertionSlot | null>((current, candidate) => {
    if (current === null) {
      return candidate;
    }
    const score = Math.abs(candidate.y - sceneY) + Math.abs(candidate.x - sceneX) * 0.55;
    const currentScore =
      Math.abs(current.y - sceneY) + Math.abs(current.x - sceneX) * 0.55;
    return score < currentScore ? candidate : current;
  }, null);
  if (closest === null) {
    return { parentId: null, parentSequenceId: null, index: 0 };
  }
  return {
    parentId: closest.parentId,
    parentSequenceId: closest.parentSequenceId,
    index: closest.index,
  };
}

export function insertionIndexAtSceneY(sceneY: number, layout: DocumentLayout): number {
  return insertionTargetAtScenePoint(layout.contentBounds.x, sceneY, layout).index;
}

export function isInsideDocumentColumn(
  sceneX: number,
  sceneY: number,
  layout: DocumentLayout,
): boolean {
  const tolerance = 32;
  return layout.pages.some(
    (page) =>
      page.visible &&
      sceneX >= page.bounds.x - tolerance &&
      sceneX <= page.bounds.x + page.bounds.width + tolerance &&
      sceneY >= page.bounds.y - tolerance &&
      sceneY <= page.bounds.y + page.bounds.height + tolerance,
  );
}
