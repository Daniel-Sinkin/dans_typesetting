# Generic Captioned wrapper

`dans.layout.captioned` composes exactly one document block with optional
writer-owned numbering, an optional reference target, and an Inline Sequence
caption. It is deliberately independent from images, tables, code listings,
plots, and grids.

## Semantic contract

- `content` is one stable named child block sequence containing exactly one
  block.
- `category` is either a non-empty trimmed string or null. The string is the
  case-sensitive identity of a numbering series; it is not an enum and its
  hash is never persisted.
- `referenceId` is optional and is valid only when a category exists.
- `captionInlines` may be empty. It contains only author content; generated
  text such as `Figure 4:` is writer state.
- A null category produces an unnumbered caption. If its caption is also empty,
  the wrapper is semantically transparent apart from ownership.

The wrapper does not inspect the child. A Python plot can therefore be naked,
captioned without a number, numbered as a `Figure`, or later placed in a Grid
without the plot plugin acquiring caption semantics.

## Writer behavior

The graphical writer derives category ordinals in normal recursive traversal
and lays out the child through generic named-sequence machinery. The parent
outline and child outline remain independently interactive. Copying recursively
refreshes block and inline authoring IDs and clears the optional reference ID.

The Markdown connector uses the category string directly as the numbering
series. Existing figures, tables, listings, and equations now publish the
capitalized category identities `Figure`, `Table`, `Listing`, and `Equation`,
so legacy plugins and generic wrappers share a series without knowing about one
another.

The LaTeX connector maps those four identities to their built-in counters.
Other UTF-8 category strings receive an injectively hex-encoded internal
counter and an `autoref` name. Content and caption are emitted inside a
`samepage` region. Writers reject an incomplete wrapper rather than dropping or
inventing content.

Existing figure/table/listing plugins have not been rewritten on top of
`Captioned`. They keep their mature specialized layout contracts and merely
share the low-level category vocabulary. Future migrations can therefore be
incremental rather than a flag-day hierarchy change.

## Deliberate constraints

- Category identity is case-sensitive: `Figure` and `figure` are independent.
- A reference without numbering is currently forbidden. If unnumbered targets
  become useful, that should be a deliberate contract extension.
- Captioned does not promise that every child is sensible for every writer.
  The registered child connector remains responsible for publication support.
- Deep recursive caption nesting is representable, but no special visual or
  counter policy is added for it.
