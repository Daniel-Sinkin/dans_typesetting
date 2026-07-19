# Nested block sequences

## Contract

A semantic block may expose zero or more stable, named, ordered child block
sequences. The document core sees only this topology:

- the owning block retains exclusive ownership of every child;
- a child occurs in exactly one sequence;
- sequence IDs are unique within their owner and are part of that plugin's
  public contract;
- traversal is deterministic pre-order: owner first, then child sequences in
  their declared order;
- moving a block into itself or any descendant is invalid.

This is an owned acyclic tree, not a general shared graph. Cross-references are
a separate graph built from stable semantic labels and never change ownership.

The native boundary is the read-only `DocumentBlock::child_sequence_*` view.
Concrete plugins remain free to store their children in whatever representation
fits their public API. The browser's transport-oriented runtime stores the same
view as `childSequences`, because editing, copying, lookup, validation, and
canonical transport all need a common structural envelope.

## Writer responsibilities

The generic traversal is intentionally insufficient to render a composite
block. The owning plugin connector decides how and where its child sequences
appear and delegates their contents back to the writer. This preserves plugin
semantics: a Grid may place several sequences side by side, while Padding places
one sequence inside four insets.

The graphical development writer asks a registered block adapter to:

1. measure each child sequence through a supplied callback;
2. include those measurements in the owner's height;
3. return a bounded placement for every exposed sequence.

Generic layout code then renders ordinary child blocks, insertion targets,
drag/move/copy operations, nested editor controls, and animated reflow without
switching on concrete plugin type IDs. A nested block is indivisible in paged
and slide modes, matching the existing development-writer policy. Pagination
control blocks are currently rejected inside contained sequences because their
scope would otherwise be ambiguous.

Sections retain one special semantic role. They expose the ordinary `body`
endpoint, but the graphical and publication writers also interpret it as a
heading hierarchy for section depth, numbering, references, and the table of
contents. Other composites do not change section depth.

## Transport and compatibility

Named sequence topology is shared; payload syntax remains plugin-owned. A
Padding codec may call its serialized array `blocks`, while a future Grid codec
may serialize cells. Decoders reconstruct the same stable endpoints. This keeps
canonical persistence explicit and lets an individual plugin migrate its schema
without teaching the document core every composite shape.

Opaque blocks may be preserved without inspecting their payload, but a runtime
block that exposes child sequences needs a graphical adapter capable of placing
every endpoint. Silently dropping nested content is never an acceptable
fallback.
