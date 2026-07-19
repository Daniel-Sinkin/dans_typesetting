# Composite figures

## Contract

`dans.image.figure_pair` is an opinionated two-panel extension rather than a
mode on the ordinary `dans.image.figure` block. It represents the paired plots
used repeatedly in the thesis corpus while keeping the first implementation
small and fully implementable by every current writer.

A pair owns exactly two horizontal panels. Each panel owns:

- a stable authoring ID;
- an image source;
- a non-empty Inline Sequence caption;
- an optional semantic reference ID;
- a preferred positive integer pixel extent.

The group owns another non-empty inline caption, an optional semantic reference
ID, and one relative width shared by both panels. The width must be in
`(0, 0.5]`; it describes each panel relative to the available line width and
leaves the writer control over the inter-panel gap. Pixel extents are authoring
and layout hints, not a physical-DPI contract.

The narrow pair is deliberate. Arbitrary grids, unequal panel widths, spanning
panels, and more than two panels should not be added as flags to this type. They
need a separate composite-layout contract once their editing and pagination
behavior is understood.

## Numbering and references

A pair advances the shared `figure` numbering series exactly once whether or
not it publishes a group target. When present, its group target renders as
`Figure 3`; optional first and second panel targets render as `Figure 3a` and
`Figure 3b`. A panel target still receives the pair's ordinal when the group is
unlabelled. Neither the visible ordinal nor the letters are stored in semantic
data, and no writer manufactures an anchor for a missing target.

The generic graphical target descriptor permits one block to publish several
optional targets with suffixes. Existing plugins continue to use the singular
target callback. The Markdown writer has the corresponding producer contract:
the first descriptor advances the series even when its reference pointer is
null, while a subordinate target reuses that ordinal and appends its suffix.

Copying a pair refreshes the block, panel, and nested inline authoring IDs and
clears the optional group and panel references. This matches ordinary figures
and prevents an Alt-drag copy from silently publishing targets the author did
not choose.

## Writers

- LaTeX lowers the pair through `subcaption` and two `subfigure` environments.
  Rich captions use the same injected inline renderer as paragraphs and tables.
- Markdown emits a two-column GFM table containing both images and panel
  captions, followed by the numbered group caption. Jupyter receives this
  representation through its configured Markdown writer.
- The graphical writer shows both images, rich captions, live figure numbering,
  and real nested panel anchors. Its editor provides immediate width feedback,
  independent image selection and pixel discovery, optional group/panel
  reference IDs, and the existing plugin-aware inline sequence editor for all
  three captions.

Markdown deliberately ignores the physical pixel hints and cannot guarantee
the requested percentage in every viewer. It preserves the side-by-side
relationship, content, captions, and reference topology.

## Verification

`native_figure_pair_test` checks validation, pixel-hint retention, rich LaTeX
captions, `subfigure` output, shared Markdown numbering, optional ordinary/group
targets, and panel-only links. The browser suite and shared conformance fixture
check exact canonical round trips with a null group target, impossible payloads,
copy identity, and multi-target numbering. The browser smoke workflow edits a
caption and width through the real UI, verifies live preview and commit, and
captures `builder/test-results/figure-pair-editor.png`.
