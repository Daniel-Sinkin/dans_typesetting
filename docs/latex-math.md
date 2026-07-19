# Text-authored LaTeX mathematics

The source-authored math plugin is the current graphical authoring path for
mathematics. It deliberately owns only content that belongs inside math
delimiters:

| Contract | Type ID | Implicit writer delimiters |
| --- | --- | --- |
| Inline math | `dans.math.latex.inline` | `$ ... $` |
| Display math | `dans.math.latex.display` | `\begin{equation} ... \end{equation}` or `\[ ... \]` |

Authors never store the delimiters themselves. Empty/whitespace-only source,
`$` characters, and line breaks in inline math are rejected. An unnumbered
display cannot publish a reference ID. The graphical editor treats invalid
text as a transient draft: it shows the error and keeps the last valid semantic
value until the source becomes valid again.

This is a scoped, trusted-source authoring contract, not a general LaTeX block,
a LaTeX importer, or a TeX security sandbox. It exists because LaTeX math is a
useful and familiar escape hatch while the project experiments with its own
document and layout model. Document setup, packages, prose, figures, headings,
and arbitrary LaTeX environments remain writer-owned or separate semantic
plugins. The existing raw-LaTeX mixin is a different, explicitly
backend-specific plugin.

## Numbering and alignment

One `dans.math.latex.display` block is one equation occurrence. A numbered
block advances the shared equation series and may publish one stable reference
target. An `aligned`, `gathered`, or matrix environment inside its source may
break that equation across visual rows, but it still receives one number. Use
separate display blocks when separate rows need separate numbers and references.

This small rule avoids making the generic builder parse TeX merely to discover
equation identities. A future semantic multi-equation container can own ordered
source rows explicitly if cross-row alignment plus independent numbering proves
important.

## Writer behavior

- The LaTeX connector inserts the source inside writer-owned math delimiters.
  Numbered displays use `equation`; unnumbered displays use `\[ ... \]`.
- The Markdown connector emits `$ ... $` or `$$ ... $$`. It writes an explicit
  equation ordinal after a numbered display because Markdown has no portable
  equation-numbering contract.
- Jupyter inherits the configured Markdown math connector, so conventional
  MathJax-capable notebook renderers receive the same source.
- The graphical preview uses KaTeX with trust disabled. KaTeX is an interactive
  approximation; the LaTeX publication build remains authoritative and may
  accept a somewhat different mathematical command set.

The older `dans.math.inline` / `dans.math.display` structured presentation tree
has not been deleted. Its transport codecs remain registered so existing
`.dans_doc` files round-trip losslessly, and its native writers/tests remain
available. It is simply benched from the active graphical palette and editors
until its interaction design is worth revisiting.
