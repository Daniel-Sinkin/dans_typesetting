# Semantic inline code

`dans.code.inline` is an Inline Sequence extension for one source-code
fragment. Its payload is deliberately small:

```json
{
  "id": "stable-inline-id",
  "type": "dans.code.inline",
  "payload": { "code": "cudaDeviceSynchronize()" }
}
```

The semantic value is source text, not a request to apply an arbitrary
monospace style to another inline node. This distinction lets Markdown,
Jupyter, PDF, and LaTeX writers choose their native code representation while
ordinary prose styles remain properties of Core Text.

The value may be empty while an editor is constructing it, but it cannot
contain CR or LF. Multiline source belongs in `dans.code.listing`. Spaces and
punctuation remain byte-preserving UTF-8 text. The native LaTeX connector emits
escaped `\texttt{...}` content and never treats the value as raw LaTeX.

The graphical plugin contributes an `Inline code` palette segment, a distinct
monospace preview, and a single-line payload editor. It can be moved, removed,
copied, nested in other inline hosts, and round-tripped through canonical
transport by the existing generic inline contracts.
