# Semantic code listings

## Contract

`dans.code.listing` stores source text, one deliberately small language hint,
and two independent optional metadata fields:

- `language` is `cpp`, `cuda`, `julia`, or `raw`;
- `code` is non-empty and byte-preserving apart from the canonical JSON string
  encoding;
- `caption` is either absent or a non-empty Core Paragraph inline sequence;
- `referenceId` is either absent or a stable semantic target.

Language is a writer hint, not a parser promise. In particular, CUDA reuses
the C++ lexical baseline with a bounded set of CUDA qualifiers and built-ins.
Raw mode deliberately applies no token classification. The document model does
not store syntax tokens, line numbers, font choices, or a measured layout box.

All listing blocks participate in the writer-owned listing-number sequence.
This remains true when no caption or reference ID is present, so inserting or
moving a captionless listing cannot make later PDF and graphical ordinals
diverge. A writer may keep that number visually hidden when there is no
caption; the graphical preview shows it in the language header.

## Native authoring and LaTeX

The native API provides concise overloads for all useful combinations:

```cpp
using dans::document::ReferenceId;
using dans::document::plugins::CodeLanguage;
using dans::document::plugins::CodeListing;

blocks.add<CodeListing>(CodeLanguage::raw, "compiler output\n");
blocks.add<CodeListing>(CodeLanguage::julia, "energy(x) = sum(abs2, x)", "Energy helper");
blocks.add<CodeListing>(
    CodeLanguage::cuda,
    "__global__ void scale(float* values) { /* ... */ }",
    ReferenceId{"lst:scale"}
);
```

The LaTeX connector uses `listings`. C++ and Julia select their respective
languages, CUDA selects the project-owned CUDA extension of C++, and raw mode
omits the `language` option. Captionless blocks explicitly advance the
`lstlisting` counter before emitting the environment; an optional label binds
to that step. Caption nodes are delegated to the shared inline renderer, so
styles, inline code, mathematics, links, and other registered extensions retain
their semantics. Source containing `\end{lstlisting}` is rejected rather than
silently terminating the generated environment.

## Graphical authoring

The editor renders a transparent textarea over a dependency-free token layer,
so the visible code surface is the editable control. Tab replaces the current
selection with four spaces. Language, source, rich caption sequence, and
reference ID update the transactional draft; caption and reference ID can be
cleared separately. The preview keeps a live `Listing N · Language` header and
only renders a caption row when a caption exists. Caption segments use the same
add/remove/reorder and plugin-owned payload editors as other inline hosts.

Canonical decoding accepts a missing legacy `caption` field as absent and a
legacy string as one deterministic Core Text segment. New documents encode
nullable `captionInlines`. Unknown languages, ambiguous old/new spellings, and
malformed optional values fail at the plugin codec boundary. See
[rich-captions.md](rich-captions.md).

## Deliberate omissions

- no LSP, semantic parser, formatter, or compiler integration;
- no stored syntax-highlight tokens;
- no arbitrary user-defined language definitions yet;
- no line-range inclusion or external-file source adapter yet;
- no automatic escaping of a literal `\end{lstlisting}` through a different
  LaTeX environment.
