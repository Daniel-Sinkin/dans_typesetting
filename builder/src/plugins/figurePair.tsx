// Register the two-panel semantic figure with the graphical writer.
import type { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { copyBuilderInlineForInsert } from "../builder/copyInline";
import type { BuilderBlockPlugin } from "../builder/plugin";
import {
  createBlockId,
  createParagraphText,
  type BuilderBlock,
} from "../model/document";
import {
  createFigurePairBlock,
  createFigurePanel,
  figurePairTypeId,
  requireFigurePairBlock,
} from "./figurePairModel";
import { FigurePairEditor, FigurePairPreview } from "./figurePairView";

function captionText(
  inlines: ReturnType<typeof requireFigurePairBlock>["captionInlines"],
  registry: BuilderInlinePluginRegistry,
): string {
  return inlines
    .map((inline) => registry.adapterForInline(inline).plainText(inline, registry))
    .join("");
}

export function createFigurePairPlugin(
  inlineRegistry: BuilderInlinePluginRegistry,
): BuilderBlockPlugin {
  return {
    typeId: figurePairTypeId,
    numberingSeries: "figure",
    palette: {
      label: "Figure pair",
      description: "Two horizontal panels with rich captions and optional targets",
      glyph: "▥",
      accentColor: "#228be6",
    },
    createDefault(blockId): BuilderBlock {
      return createFigurePairBlock(
        blockId,
        createFigurePanel(
          createBlockId(),
          "/sample-domain-decomposition.svg",
          [createParagraphText("Left panel.")],
        ),
        createFigurePanel(
          createBlockId(),
          "/sample-domain-decomposition.svg",
          [createParagraphText("Right panel.")],
        ),
        [createParagraphText("A new paired figure caption.")],
      );
    },
    referenceTargets(block) {
      const pair = requireFigurePairBlock(block);
      return [
        {
          referenceId: pair.referenceId,
          label: "Figure",
          title: captionText(pair.captionInlines, inlineRegistry),
        },
        ...pair.panels.map((panel, index) => ({
          referenceId: panel.referenceId,
          label: "Figure",
          title: captionText(panel.captionInlines, inlineRegistry),
          numberSuffix: index === 0 ? "a" : "b",
        })),
      ];
    },
    numberedInlineOccurrences(block) {
      const pair = requireFigurePairBlock(block);
      return inlineRegistry.numberedOccurrences([
        ...pair.captionInlines,
        ...pair.panels.flatMap((panel) => panel.captionInlines),
      ]);
    },
    copyForInsert(block, copiedBlockId) {
      const pair = requireFigurePairBlock(block);
      const copyCaption = (inlines: typeof pair.captionInlines) =>
        inlines.map((inline) =>
          copyBuilderInlineForInsert(inline, inlineRegistry),
        );
      const copyPanel = (index: number) => {
        const panel = pair.panels[index];
        if (panel === undefined) {
          throw new Error("Figure-pair copy lost a required panel");
        }
        return createFigurePanel(
          createBlockId(),
          panel.source,
          copyCaption(panel.captionInlines),
          null,
          panel.preferredPixelWidth,
          panel.preferredPixelHeight,
        );
      };
      return createFigurePairBlock(
        copiedBlockId,
        copyPanel(0),
        copyPanel(1),
        copyCaption(pair.captionInlines),
        null,
        pair.panelWidthFraction,
      );
    },
    measure(block, availableWidth) {
      const pair = requireFigurePairBlock(block);
      const panelWidth = availableWidth * pair.panelWidthFraction;
      const tallestImage = Math.max(
        ...pair.panels.map(
          (panel) =>
            panelWidth *
            (panel.preferredPixelHeight / panel.preferredPixelWidth),
        ),
      );
      return Math.min(520, Math.max(280, tallestImage + 128));
    },
    renderPreview(block, context) {
      return (
        <FigurePairPreview
          pair={requireFigurePairBlock(block)}
          registry={inlineRegistry}
          context={{
            referenceTargets: context.referenceTargets,
            inlineOrdinals: context.inlineOrdinals,
            documentResources: context.documentResources,
          }}
          ordinal={context.ordinal ?? 0}
        />
      );
    },
    editor: {
      title(block) {
        return `Edit figure pair · ${requireFigurePairBlock(block).id}`;
      },
      render(props) {
        return <FigurePairEditor {...props} inlineRegistry={inlineRegistry} />;
      },
    },
  };
}
