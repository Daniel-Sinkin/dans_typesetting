# Trusted Python / Matplotlib plots

`dans.plot.python` stores trusted Python source plus two pieces of author
intent: a relative document width and a target pixel extent. Generated SVG,
PDF, or PNG data is writer-owned output/cache state and never enters the
semantic document.

The plot block has no caption, number, or reference. Compose it with
`dans.layout.captioned` when those semantics are wanted.

## Authoring path

The graphical editor presents Python source and a debounced live SVG preview
side by side. `numpy` is preloaded as `np` and `matplotlib.pyplot` as `plt`.
Source may assign its chosen Matplotlib figure to `figure`; otherwise the
renderer uses `plt.gcf()`. Tab inserts four spaces.

Vite exposes a local POST capability at `/api/python-plot/render`. It starts
the shared Python renderer without a shell, writes one validated JSON request
to stdin, and returns SVG. The browser consumes that response through a Blob
image URL rather than inserting executable SVG markup into the page.

This is explicitly not a security sandbox. Source runs with the normal user
permissions of the local builder process and must be trusted. The current
defensive bounds protect the editor from accidents, not hostile code:

- source length: at most 100,000 UTF-8 bytes;
- target width/height: 64 through 4096 pixels;
- render timeout: 8 seconds;
- SVG output: at most 6 MiB;
- retained diagnostics: at most 64 KiB.

The Vite middleware exists in development and preview servers. A static-only
deployment cannot execute Python and needs a companion capability with the
same request contract.

## Publication path

Native LaTeX and Markdown connectors receive an injected asset resolver. The
resolver owns execution, caching, filenames, and invalidation; the connectors
only consume the resolved path. LaTeX accepts its normal PDF/PNG/JPEG graphics
formats, while Markdown emits a portable image link.

The example CMake pipeline invokes `builder/scripts/render_python_plot.py` on a
committed source file to create a PDF, then the ordinary LaTeX writer includes
that asset. This is intentionally the same renderer used by the live browser
capability, preventing a second incompatible execution convention.

Target pixel extent controls the generated figure aspect and Matplotlib's
relative text scale. Relative width controls how much of the containing layout
width the finished asset should occupy. A writer may ignore either hint when
its medium cannot honor it.

## Tests

Coverage includes exact canonical browser round trips, semantic validation,
shared Captioned/Figure numbering, deep-copy identity, mocked client errors,
real NumPy/Matplotlib subprocess rendering, syntax diagnostics, timeout
termination, live browser edit/save/reopen interaction, native LaTeX and
Markdown resolution, and compilation of the sample PDF.
