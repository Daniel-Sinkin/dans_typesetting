# Structured math annotations

Math annotations are semantic presentation nodes, not raw LaTeX fragments.
This slice adds three deliberately small pieces shared by native publication
writers and the graphical authoring model:

- an `upright` identifier style for atomic names such as `cores`;
- a single-line `text` leaf for human-readable annotations;
- an `underbrace` node with recursive `body` and `annotation` children.

The native API composes them directly:

```cpp
using M = dans::document::plugins::Math;

auto annotated = M::underbrace(
    M::upright("cores") * M::integer(2),
    M::text("FMA & SIMD")
);
```

The TeX connector lowers this to `\underbrace{\mathrm{cores} \cdot
2}_{\text{FMA \& SIMD}}`. Math text escapes TeX-special characters rather
than interpreting them as commands. It must be non-empty and may contain UTF-8
text and ordinary spaces, but it rejects ASCII control characters and line
breaks. This keeps it distinct from both a symbolic identifier and the
unrestricted LaTeX mixin.

## Graphical authoring

`underbrace` exposes `body` and `annotation` as normal math paths. Both inherit
recursive selection, replacement, thresholded detach, temporary parking,
clipboard transport, and typed slot insertion. The palette contributes an
upright identifier placeholder, a text leaf, and a two-slot underbrace.

The optional basic-input parser accepts:

| Input | Result |
| --- | --- |
| `rm(cores)` | atomic upright identifier |
| `text(FMA)` | one-word semantic text |
| `text("FMA & SIMD")` | quoted semantic text with spaces |
| `underbrace(rm(cores) cdot 2, text("FMA & SIMD"))` | recursive annotation |

Quoted input supports `\"` and `\\` escapes. It rejects unknown escapes,
unterminated strings, and embedded line breaks with a source position.

Canonical and clipboard payloads remain schema/version 1. Upright identifiers
use the existing optional `style` field, text stores `{kind, value}`, and an
underbrace stores its two recursive children. Node IDs remain editor-local and
are regenerated when parsing serialized data.

## Deliberate limits

Math text is not a Core Paragraph inline sequence: it does not contain colour,
links, citations, footnotes, inline math, or nested prose styles. Underbrace
owns exactly one annotation expression and does not imply evaluation or a
general accent system. Overbraces, overset/underset, labelled arrows, multiline
annotations, and arbitrary font switches remain separate structures.
