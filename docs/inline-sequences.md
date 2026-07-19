# Inline Sequence boundary

`InlineSequence` is a standalone semantic foundation. It owns an ordered set of
`InlineNode` values and knows nothing about paragraphs, captions, colour,
mathematics, authoring syntax, or output formats. Ordinary text is one inline
plugin; a paragraph is one block plugin that happens to own an `InlineSequence`.
Footnotes, hyperlink labels, figure captions, list items, and table cells consume
the same foundation without depending on paragraph implementation details.

Each writer supplies one inline-adapter registry. Hosts inject that registry and
delegate their inline content to it, then contribute only their own surrounding
structure. Adding an inline kind consequently requires its semantic plugin and
the desired writer adapters, but it does not require edits to Paragraph or to
every other host.

The native and graphical implementations deliberately retain the canonical type
IDs `dans.core.text` and `dans.core.paragraph`. Refactoring module ownership does
not rewrite persisted documents.

## Optional authoring markup

A near-WYSIWYG text notation is useful, but it is a producer of semantic data—not
part of `InlineSequence` itself. The intended optional boundary is:

- an `InlineMarkupParser` consumes authoring text and produces an
  `InlineSequence` plus source diagnostics;
- plugin-owned `InlineCommandProvider` implementations register commands with
  that parser;
- a graphical adapter supplies live text editing and preview over the same
  parser protocol;
- exporters consume only the resulting explicit inline nodes.

Stateful input such as a colour command with `store`, `red`, and `reset` may keep
a parse-time context stack. Its result should be explicit nested `ColorSpan`
nodes, so writers do not replay hidden state. Authoring commands, backend output
escaping, and semantic nodes remain three separate concerns.

This producer protocol is a designed extension seam, not yet an implemented
document feature. Until it exists, the graphical segment editor edits the
semantic sequence directly.
