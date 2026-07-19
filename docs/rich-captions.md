# Rich caption contract

Ordinary figures, paired figures, tables, and captioned code listings consume
the standalone Inline Sequence contract. A caption is therefore not
a writer-ready string: it may contain styled Core Text, semantic inline code,
structured inline mathematics, colour spans, hyperlinks, references,
citations, footnotes, and preserved opaque extensions when their adapters are
registered.

The host plugin owns caption presence and ordering:

- `dans.image.figure`, `dans.image.figure_pair`, and `dans.table` require a
  non-empty inline sequence;
- each panel in `dans.image.figure_pair` requires its own non-empty sequence;
- `dans.code.listing` stores either no caption or one non-empty sequence.

The inline nodes retain their own stable authoring IDs and plugin payloads. A
host validates root identity, exposes the roots for writer-owned occurrence
numbering, and delegates rendering to the writer's inline registry. It never
switches on concrete inline type IDs. Copying a host recursively refreshes the
inline IDs through plugin copy hooks while clearing the host's reference target.
Figures and paired figures remain captioned and numbered after that target is
cleared; target publication is not the condition for joining a numbering series.

## Graphical editing

The graphical connector has one reusable inline-sequence preview/editor shared
by every host rather than owned by Paragraph or tables. Figures, paired
figures, table captions/cells, and listings all compose that control. It shows
the sequential caption, invokes each segment plugin's payload editor, supports
adding/removing/reordering segments, and preserves unsupported nodes as visible
read-only content.

Figure and listing editors publish valid drafts through the ordinary
transactional block-editor seam. Figure width, image choice, and caption edits
appear in one live preview. Listing source highlighting and rich-caption edits
also update one live preview; removing a listing caption does not affect its
language, source, reference target, or writer-derived ordinal.

## Canonical compatibility

Current figure payloads use required `captionInlines`; current listing payloads
use nullable `captionInlines`. Each entry is the standard `{id, type, payload}`
inline envelope. The browser codecs still accept the earlier figure/listing
`caption` string and normalize it into a deterministic Core Text node. An
omitted legacy listing caption normalizes to `null`. Payloads containing both
spellings are rejected as ambiguous.

This is a plugin-payload normalization inside canonical schema version 1. New
files always emit the rich form, and the shared fixture uses that form.

## Writer behavior

Native LaTeX and Markdown connectors already consume the same injected inline
renderer for figure, paired-figure, table, and listing captions. Jupyter
inherits the Markdown behavior. A writer missing a connector for any nested
inline type fails or emits its explicit unsupported-content policy; it never
silently flattens a caption to plain text. Plain-text projection is used only
for accessibility labels and reference-picker titles in the graphical writer.
