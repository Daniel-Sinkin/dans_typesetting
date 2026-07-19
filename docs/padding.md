# Padding block

`dans.layout.padding` is the first non-section consumer of the generic nested
block-sequence contract. It owns one named `content` sequence and four finite,
non-negative inset hints expressed in em units: top, right, bottom, and left.

The values are semantic author intent rather than measured geometry. A writer
may map, reject, or deliberately flatten that intent, but it must retain the
nested content:

- the graphical development writer maps one em to 16 preview pixels and clamps
  excessive horizontal insets proportionally so at least 24 pixels remain for
  content;
- the LaTeX connector uses breakable `adjustwidth` plus vertical `\vspace*`;
- the portable Markdown connector flattens the insets and writes the content in
  order because Markdown has no dependable padding primitive.

Padding is a container, not blank vertical space. A future `Spacer` leaf should
represent an intentional empty gap without manufacturing an empty child
sequence.

Copying a Padding block refreshes the identity of every descendant while
preserving endpoint names and inset values. The builder can insert, reorder,
move, and Alt-copy ordinary blocks directly within the visible inset region.
