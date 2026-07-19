// builder/src/plugins/opaque.tsx — visibly represent block types without a graphical adapter.
import type { BuilderFallbackAdapter } from "../builder/plugin";

export const opaqueBlockAdapter: BuilderFallbackAdapter = {
  palette: {
    label: "Opaque block",
    description: "No graphical adapter is registered",
    glyph: "◇",
    accentColor: "#845ef7",
  },
  measure() {
    return 132;
  },
  renderPreview(block) {
    return (
      <div className="opaque-block-content">
        <span>PREVIEW ADAPTER MISSING</span>
        <strong>{block.typeId}</strong>
        <code>{block.id}</code>
      </div>
    );
  },
};
