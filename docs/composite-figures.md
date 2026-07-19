# Composite figures

## Contract

`dans.image.figure_pair` is an opinionated two-panel extension rather than a
mode on the ordinary `dans.image.figure` block. It represents the paired plots
used repeatedly in the thesis corpus while keeping the first implementation
small and fully implementable by every current writer.

A pair owns exactly two horizontal panels. Each panel owns:

- a stable authoring ID;
- an image source;
- a non-empty Core Paragraph inline caption;
- an optional semantic reference ID;
- a preferred positive integer pixel extent.

The group owns another non-empty inline caption, a required semantic reference
ID, and one relative width shared by both panels. The width must be in
`(0, 0.5]`; it describes each panel relative to the available line width and
leaves the writer control over the inter-panel gap. Pixel extents are authoring
and layout hints, not a physical-DPI contract.

The narrow pair is deliberate. Arbitrary grids, unequal panel widths, spanning
panels, and more than two panels should not be added as flags to this type. They
need a separate composite-layout contract once their editing and pagination
behavior is understood.

## Numbering and references

A pair advances the shared `figure` numbering series exactly once. Its group
target renders as `Figure 3`; optional first and second panel targets render as
`Figure 3a` and `Figure 3b`. Neither the visible ordinal nor the letters are
stored in semantic data.

The generic graphical target descriptor now permits one block to publish
several targets with suffixes. Existing plugins continue to use the singular
target callback. The Markdown writer has the corresponding producer contract:
a subordinate target reuses the current series ordinal and appends its suffix
without advancing the counter.

Copying a pair refreshes the block, panel, and nested inline authoring IDs. It
assigns a fresh group reference based on the copied block ID and clears both
optional panel references, preventing an Alt-drag copy from creating ambiguous
targets.

## Writers

- LaTeX lowers the pair through `subcaption` and two `subfigure` environments.
  Rich captions use the same injected inline renderer as paragraphs and tables.
- Markdown emits a two-column GFM table containing both images and panel
  captions, followed by the numbered group caption. Jupyter receives this
  representation through its configured Markdown writer.
- The graphical writer shows both images, rich captions, live figure numbering,
  and real nested panel anchors. Its editor provides immediate width feedback,
  independent image selection and pixel discovery, group/panel reference IDs,
  and the existing plugin-aware inline sequence editor for all three captions.

Markdown deliberately ignores the physical pixel hints and cannot guarantee
the requested percentage in every viewer. It preserves the side-by-side
relationship, content, captions, and reference topology.

## Verification

`native_figure_pair_test` checks validation, pixel-hint retention, rich LaTeX
captions, `subfigure` output, shared Markdown numbering, and group/panel links.
The browser suite checks canonical round-trip idempotence, impossible payloads,
copy identity, and multi-target numbering. The browser smoke workflow edits a
caption and width through the real UI, verifies live preview and commit, and
captures `builder/test-results/figure-pair-editor.png`.
