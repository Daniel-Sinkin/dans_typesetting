// Register semantic cross-references with the shared Inline Sequence contract.
import { createElement } from "react";

import type { BuilderInlinePlugin } from "../builder/inlinePlugin";
import {
  createReferenceInline,
  referenceInlineTypeId,
} from "../model/document";
import { requireReference } from "./referenceSupport";
import { ReferenceEditor, ReferencePreview } from "./referenceView";

export const referenceInlinePlugin: BuilderInlinePlugin = {
  typeId: referenceInlineTypeId,
  palette: {
    label: "Reference",
    description: "A live link to a numbered semantic target",
    glyph: "§",
    accentColor: "#5f3dc4",
  },
  createDefault(inlineId) {
    return createReferenceInline("sec:target", inlineId);
  },
  plainText(inline) {
    return `[${requireReference(inline).targetReferenceId}]`;
  },
  renderPreview(inline, _registry, context) {
    return createElement(ReferencePreview, { inline, context });
  },
  editor: {
    render(props) {
      return createElement(ReferenceEditor, props);
    },
  },
};
