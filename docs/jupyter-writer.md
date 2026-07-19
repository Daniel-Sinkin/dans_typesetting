# Jupyter writer

## First notebook policy

The first Jupyter target is a language-neutral presentation notebook. It wraps
the complete output of one configured authoritative `MarkdownWriter` in a
single Markdown cell and owns only the `.ipynb` container. This is an explicit
policy choice, not a limitation imposed on future notebook writers.

The emitted notebook uses nbformat 4.5:

- one `markdown` cell with the stable ID `dans-document`;
- source represented as an array of lines whose concatenation is byte-for-byte
  equal to the standalone Markdown export;
- optional `metadata.dans_typesetting` containing the document-model version
  and source-writer profile;
- no kernel or language metadata.

These choices follow the official
[notebook format](https://nbformat.readthedocs.io/en/latest/format_description.html):
cell source may be a string or line array, metadata may contain optional
application fields, and schema 4.5 requires unique 1–64 character cell IDs.
Jupyter Markdown renderers conventionally support CommonMark/GFM and MathJax,
as summarized by the official
[markup documentation](https://nbformat.readthedocs.io/en/latest/markup.html).

## Why listings are not code cells

A thesis document may contain Julia, C++, CUDA, shell fragments, and untyped
pseudocode in one ordered sequence. A Jupyter notebook has one declared kernel.
Turning every semantic listing into an executable cell would therefore make a
false claim about most blocks and would change a presentation contract into an
execution contract.

This first policy leaves every listing as a fenced source block inside the
Markdown cell and deliberately omits `kernelspec`. A future kernel-specific
writer may accept an explicit language/kernel policy, partition compatible
listings into code cells, define execution counts and outputs, and leave other
listings as presentation content. That belongs in a separate module rather
than an option hidden inside this container.

## Composition and failures

`JupyterWriter` owns a configured `MarkdownWriter` through a shared immutable
handle. It does not register duplicate block or inline connectors. Consequently
the notebook supports exactly the semantic grid supported by that Markdown
writer, including its target/resource prepass, and propagates missing-adapter,
duplicate-target, and unresolved-reference failures unchanged.

The current Markdown profile uses external image paths. The notebook writer
does not yet rewrite them into nbformat cell attachments, so moving a notebook
without its asset tree is an explicit portability limitation. Raw LaTeX and
embedded Excalidraw blocks remain unsupported for the same reasons documented
by the Markdown writer.

## Verification

`native_jupyter_test` reconstructs the cell source and compares it exactly with
an independent Markdown serialization, checks nbformat numbers, cell identity,
typesetting metadata, mixed-language fenced listings, absence of a kernel,
strict failure propagation, stream/file equality, and JSON parse/serialize
stability. The generated fixture is
`build-*/native-jupyter-test.ipynb` and also passes the standard-library JSON
parser used during local verification.
