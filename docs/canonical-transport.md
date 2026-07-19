# Canonical document transport

Canonical files use the `.dans.json` suffix and UTF-8 JSON. Schema version 1 is:

```json
{
  "format": "dans.typesetting.document",
  "schemaVersion": 1,
  "documentVersion": { "major": 0, "minor": 1, "patch": 0 },
  "blocks": [
    { "id": "stable-authoring-id", "type": "plugin.type.id", "payload": {} }
  ]
}
```

`schemaVersion` versions the envelope and payload-routing protocol.
`documentVersion` is author metadata and retains the original `u16`, `u16`,
`u32` bounds. It is not the application version and does not select a parser.

## Invariants

- The format marker and schema version must match exactly.
- Block IDs and type IDs are non-empty; block IDs are unique in their sequence.
- Block order is authoring order.
- Payload is any finite JSON value. Its schema belongs to the plugin identified
  by `type`, not to the document core.
- Inline plugin nodes use the same `{id, type, payload}` envelope inside the
  owning block payload. Their containing plugin defines ordering and identity
  constraints.
- Missing plugin codecs do not make a document unreadable. Unknown payload is
  preserved losslessly through load/save and shown as an explicit placeholder
  by partial graphical writers.
- Deserialization validates a complete replacement before mutating the active
  document, so a failed load cannot partially destroy the current document.
- No LaTeX importer exists or is planned. LaTeX is writer output.

Object key order has no semantic meaning, but both implementations currently
emit two-space-indented deterministic JSON with a final newline. The shared
fixture in `fixtures/canonical/` must normalize byte-for-byte in native and
browser tests. This catches accidental spelling, ordering, number, and payload
drift while still allowing ordinary JSON consumers.

## Plugin evolution

A plugin owns its payload codec and validation. Compatible optional additions
stay within that plugin's payload. An incompatible payload change requires a
plugin-specific version field or a new semantic type ID; changing the global
schema version solely for one plugin is discouraged. Envelope changes require a
new global schema version and an explicit migration into the current in-memory
form.

Native semantic materializers are intentionally separate from the generic
transport parser. This keeps a document containing an unavailable plugin
round-trippable and prevents the transport core from accumulating knowledge of
every block kind.

Nested host plugins retain the same envelope rule at every extension point. For
example, `dans.table` owns row and cell IDs plus rectangularity, while each
caption or cell inline is encoded through the shared `{id, type, payload}`
registry. CSV never appears in that payload: it is an optional adapter that
constructs or projects the semantic table contract.

Structured-math expressions are recursively encoded inside their block or
inline plugin payload. The core `grid` node uses positive numeric `rows` and
`columns` plus exactly `rows * columns` recursive `cells`. MatVec does not add a
transport kind: matrices and vectors are square-delimited grids, so documents
remain readable when the optional graphical MatVec palette is not registered.
