# Decorated identifiers and mathematical functions

Structured math distinguishes an identifier's semantic spelling from its
presentation alphabet. An identifier is still one atomic leaf, but it now owns
one of four styles: ordinary italic, upright roman, blackboard bold, or
calligraphic. Styles
do not wrap arbitrary expression trees. This keeps validation small and avoids
pretending that `mathbb` or `mathcal` is meaningful for every nested structure.

The native authoring API exposes the contract directly:

```cpp
using M = dans::document::plugins::Math;

auto statement = M::element_of(
    M::named_operator("spectrum").argument(M::calligraphic("H")),
    M::blackboard("R")
);
auto ordinary = M::function("f").argument(M::blackboard("C"));
auto implementation_name = M::upright("cores");
```

`function` and `named_operator` are recursive presentation nodes. Both own a
name, one argument expression, and a delimiter choice. Ordinary functions are
italic and default to parentheses. Named operators are upright, lower through
LaTeX `\operatorname`, and default to square brackets. A comma-sequence
argument represents multiple visible arguments without introducing a second
function-specific collection contract.

The TeX connector lowers upright, blackboard, and calligraphic identifiers
through `\mathrm`, `\mathbb`, and `\mathcal`. The LaTeX writer owns the required `amsfonts`
package. Markdown reuses the same TeX math connector and Jupyter composes the
configured Markdown writer, so all three publication paths share spelling.

## Graphical authoring

The browser preview uses Unicode mathematical alphabets while canonical data
stores ASCII names plus semantic styles. Function arguments are ordinary math
paths named `argument`; they therefore inherit nested selection, replacement,
thresholded detach, temporary parking, clipboard operations, and typed input.
The function name belongs to the whole node rather than being a draggable
child. Replacing or renaming the whole node uses the existing Insert action and
the optional input parser.

The basic parser accepts:

| Input | Result |
| --- | --- |
| `bb(R)` | blackboard-bold `R` |
| `cal(H)` | calligraphic `H` |
| `rm(cores)` | upright `cores` |
| `f(x)` or `f[x]` | ordinary function application |
| `op(spectrum, cal(H))` | upright named operator with a square-delimited argument |

The graphical palette supplies placeholder upright/blackboard/calligraphic `A` leaves,
an ordinary `f(x)` structure, and a named `op[x]` structure. Typed parser input
is the current way to choose their concrete names.

## Transport and limits

Ordinary italic identifiers retain the original `{kind, name}` payload exactly;
only decorated leaves emit `style`. Function payloads record `name`,
`namedOperator`, `delimiter`, and the recursive `argument`. This is an additive
version-1 vocabulary extension, and normalized clipboard serialization remains
byte-stable.

This slice intentionally does not add bold, sans-serif, or fraktur
alphabets; arbitrary TeX commands; mathematical evaluation; overload/type
semantics; or a separately typed multi-argument function node. Calligraphic
lowercase output is permitted but publication fonts may render it less
distinctively than uppercase mathematical symbols.

Human-readable annotations are a distinct leaf rather than an identifier
style; see [math-annotations.md](math-annotations.md).
