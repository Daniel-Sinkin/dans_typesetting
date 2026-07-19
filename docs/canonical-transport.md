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

Ordinary figures use required `captionInlines`, while code listings use
nullable `captionInlines`; both contain the same inline envelopes. Their browser
codecs normalize the earlier plain `caption` string into one deterministic Core
Text node, and an omitted legacy listing caption into `null`. New files emit
only the rich spelling. See [rich-captions.md](rich-captions.md).

Ordinary figures and two-panel figure groups store nullable `referenceId`
values independently from their required captions. Each panel target is also
nullable. Null means that no anchor is published; it does not suppress the
writer-owned figure ordinal. The shared fixture includes a numbered pair with a
null group target and one named panel to exercise this distinction.

Structured-math expressions are recursively encoded inside their block or
inline plugin payload. The core `grid` node uses positive numeric `rows` and
`columns` plus exactly `rows * columns` recursive `cells`. MatVec does not add a
transport kind: matrices and vectors are square-delimited grids, so documents
remain readable when the optional graphical MatVec palette is not registered.
Fraction nodes encode recursive `numerator` and `denominator` values. Radical
nodes encode a recursive `body` plus a nullable `degree`. Script nodes encode a
recursive `base` plus nullable `subscript` and `superscript` values, with at
least one script required. These kinds use the existing schema-version-1 math
payload and are covered by exact fixture normalization. Binary payloads store
semantic relation/product names, while symbol payloads store registered names
such as `partial` or `capital_omega`; neither stores Unicode glyphs nor TeX
commands. See [math-vocabulary.md](math-vocabulary.md).

Identifier payloads keep the original `{kind: "identifier", name}` spelling
for ordinary italic symbols and add `style` only for `upright`, `blackboard`,
or `calligraphic` leaves. Function payloads own an ASCII `name`, Boolean
`namedOperator`, one of the registered delimiter names, and one recursive
`argument`. IDs remain editor-local and are regenerated on decode. See
[math-identifiers-and-functions.md](math-identifiers-and-functions.md).

Math-text payloads store one validated `value`. Underbrace payloads own
recursive `body` and `annotation` expressions. They extend the same version-1
math vocabulary and never store the TeX commands used by a publication writer.
See [math-annotations.md](math-annotations.md).

Integer and decimal payloads store their numeric spelling as a JSON string, not
a JSON number. Integer values contain only digits. Decimal values contain one
decimal point and at least one digit, preserving forms such as `003.20`, `.25`,
and `3.` exactly. A sign is a separate `negated` payload with one recursive
`body`; it is never embedded in either literal. See
[math-numeric-literals.md](math-numeric-literals.md).

Inline source code uses `dans.code.inline` with one string-valued `code` field.
CR and LF are rejected because multiline source belongs to the listing plugin;
all other code punctuation is stored semantically rather than writer-escaped.

Citation nodes use `dans.bibliography.citation` with a non-empty ordered `keys`
array. A `dans.bibliography.references` block stores complete normalized entry
records, including stable browser authoring IDs and nullable optional fields.
The canonical document never stores visible citation numbers: writers derive
those from current entry order. BibTeX is not embedded in this payload. The
independent source adapters normalize BibTeX or the bespoke bibliography JSON
format into the same records before canonical document serialization.
