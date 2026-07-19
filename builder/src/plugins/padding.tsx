// Register the Padding layout-intent block with contained child flow.
import type { BuilderBlockPlugin } from "../builder/plugin";
import { PaddingEditor } from "./paddingEditor";
import {
  createPaddingBlock,
  paddingContentSequenceId,
  paddingTypeId,
  requirePaddingBlock,
  type PaddingInsets,
} from "./paddingModel";

const pixelsPerEm = 16;
const minimumContentWidthPx = 24;

function resolvedHorizontalInsets(
  insets: PaddingInsets,
  availableWidth: number,
): Readonly<{ leftPx: number; rightPx: number }> {
  const requestedLeftPx = insets.leftEm * pixelsPerEm;
  const requestedRightPx = insets.rightEm * pixelsPerEm;
  const requestedTotal = requestedLeftPx + requestedRightPx;
  const availablePadding = Math.max(0, availableWidth - minimumContentWidthPx);
  const scale = requestedTotal <= availablePadding || requestedTotal === 0
    ? 1
    : availablePadding / requestedTotal;
  return {
    leftPx: requestedLeftPx * scale,
    rightPx: requestedRightPx * scale,
  };
}

export const paddingPlugin: BuilderBlockPlugin = {
  typeId: paddingTypeId,
  palette: {
    label: "Padding",
    description: "Inset a nested block sequence using em-based layout intent",
    glyph: "▣",
    accentColor: "#20c997",
  },
  createDefault(blockId) {
    return createPaddingBlock(blockId, {
      topEm: 2,
      rightEm: 1,
      bottomEm: 2,
      leftEm: 1,
    });
  },
  copyForInsert(block, copiedBlockId) {
    const padding = requirePaddingBlock(block);
    return createPaddingBlock(copiedBlockId, padding.insets);
  },
  measure(block, availableWidth, context) {
    const padding = requirePaddingBlock(block);
    const { leftPx, rightPx } = resolvedHorizontalInsets(
      padding.insets,
      availableWidth,
    );
    const childHeight = context.measureChildSequence(
      paddingContentSequenceId,
      availableWidth - leftPx - rightPx,
    );
    return Math.max(
      1,
      padding.insets.topEm * pixelsPerEm +
        childHeight +
        padding.insets.bottomEm * pixelsPerEm,
    );
  },
  layoutChildSequences(block, availableWidth) {
    const padding = requirePaddingBlock(block);
    const { leftPx, rightPx } = resolvedHorizontalInsets(
      padding.insets,
      availableWidth,
    );
    return [
      {
        sequenceId: paddingContentSequenceId,
        offsetX: leftPx,
        offsetY: padding.insets.topEm * pixelsPerEm,
        width: availableWidth - leftPx - rightPx,
      },
    ];
  },
  renderPreview(block) {
    const padding = requirePaddingBlock(block);
    return (
      <div className="padding-block-preview" aria-label="Padding layout block">
        <span>
          {padding.insets.topEm} · {padding.insets.rightEm} · {padding.insets.bottomEm} ·{" "}
          {padding.insets.leftEm} em
        </span>
      </div>
    );
  },
  editor: {
    title(block) {
      return `Edit padding · ${requirePaddingBlock(block).id}`;
    },
    render(props) {
      return <PaddingEditor {...props} />;
    },
  },
};
