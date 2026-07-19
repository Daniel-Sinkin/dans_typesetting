// React preview and editing views for normalized bibliography data.
import { useEffect, useMemo, useRef, useState } from "react";

import { resourcesInNamespace } from "../builder/documentResources";
import type {
  BuilderInlineEditorProps,
  BuilderInlineRenderContext,
} from "../builder/inlinePlugin";
import type {
  BuilderBlockEditorProps,
  BuilderBlockRenderContext,
} from "../builder/plugin";
import type { BuilderInlineNode } from "../model/document";
import {
  bibliographyResourceNamespace,
  citationKeyPattern,
  createBibliographyBlock,
  createBibliographyEntry,
  createCitationInline,
  isBibliographyEntry,
  requireBibliographyBlock,
  requireCitationInline,
  type BibliographyBlock,
  type BibliographyEntryKind,
  type BuilderBibliographyEntry,
} from "./bibliographyModel";
import type { BibliographySourceCapability } from "./bibliographySources";

function EntryPreview({ entry }: Readonly<{ entry: BuilderBibliographyEntry }>) {
  return (
    <>
      {entry.authors.length === 0 ? null : (
        <span className="bibliography-entry__authors">{entry.authors.join("; ")}. </span>
      )}
      <cite>{entry.title}</cite>.{" "}
      {entry.venue === null ? null : <span>{entry.venue}. </span>}
      {entry.publisher === null ? null : <span>{entry.publisher}. </span>}
      {entry.year === null ? null : <span>{entry.year}. </span>}
      {entry.doi === null ? null : (
        <a
          href={`https://doi.org/${entry.doi}`}
          target="_blank"
          rel="noreferrer"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          doi:{entry.doi}
        </a>
      )}{" "}
      {entry.url === null ? null : (
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          {entry.url}
        </a>
      )}
    </>
  );
}

export function BibliographyPreview({
  bibliography,
  context,
}: Readonly<{
  bibliography: BibliographyBlock;
  context: Pick<BuilderBlockRenderContext, "documentResources">;
}>) {
  const resources = resourcesInNamespace(
    context.documentResources,
    bibliographyResourceNamespace,
  );
  return (
    <section className="bibliography-content" data-bibliography-id={bibliography.id}>
      <h2>References</h2>
      {bibliography.entries.length === 0 ? (
        <p className="bibliography-content__empty">No bibliography entries.</p>
      ) : (
        <ol>
          {bibliography.entries.map((entry, index) => {
            const resource = resources.get(entry.key);
            return (
              <li
                id={resource?.anchorId}
                key={entry.id}
                value={resource?.ordinal ?? index + 1}
                data-bibliography-entry-key={entry.key}
              >
                <EntryPreview entry={entry} />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function CitationPreview({
  inline,
  context,
}: Readonly<{
  inline: BuilderInlineNode;
  context: BuilderInlineRenderContext;
}>) {
  const citation = requireCitationInline(inline);
  const resources = resourcesInNamespace(
    context.documentResources,
    bibliographyResourceNamespace,
  );
  return (
    <span className="inline-citation" data-citation-inline-id={citation.id}>
      [
      {citation.keys.map((key, index) => {
        const resource = resources.get(key);
        const entry = resource?.value;
        const resolved = resource !== undefined && isBibliographyEntry(entry);
        return (
          <span key={key}>
            {index === 0 ? null : ", "}
            {resolved ? (
              <a
                href={`#${resource.anchorId}`}
                title={entry.title}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                {resource.ordinal}
              </a>
            ) : (
              <span
                className="inline-citation--unresolved"
                title={`No bibliography entry named ${key}`}
              >
                ?{key}
              </span>
            )}
          </span>
        );
      })}
      ]
    </span>
  );
}

function parseCitationInput(value: string): readonly string[] {
  const keys = value.split(",").map((key) => key.trim());
  if (keys.some((key) => !citationKeyPattern.test(key))) {
    throw new Error("Use comma-separated citation keys with no empty values");
  }
  if (new Set(keys).size !== keys.length) {
    throw new Error("A citation cannot repeat a key");
  }
  return keys;
}

export function CitationEditor({ inline, onChange, context }: BuilderInlineEditorProps) {
  const citation = requireCitationInline(inline);
  const [source, setSource] = useState(citation.keys.join(", "));
  const [error, setError] = useState<string | null>(null);
  const resources = resourcesInNamespace(
    context.documentResources,
    bibliographyResourceNamespace,
  );

  const publish = (nextSource: string): void => {
    setSource(nextSource);
    try {
      const keys = parseCitationInput(nextSource);
      onChange(createCitationInline(keys, citation.id));
      setError(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Invalid citation keys");
    }
  };

  return (
    <div className="citation-inline-editor">
      <label className="editor-field">
        <span>Citation keys · comma separated</span>
        <input
          data-citation-editor-id={citation.id}
          value={source}
          onChange={(event) => {
            publish(event.target.value);
          }}
          onBlur={() => {
            if (error !== null) {
              setSource(citation.keys.join(", "));
              setError(null);
            }
          }}
        />
      </label>
      {error === null ? null : <small className="editor-error">{error}</small>}
      <div className="citation-inline-editor__choices">
        {[...resources.values()].map((resource) => {
          const selected = citation.keys.includes(resource.key);
          return (
            <button
              key={resource.key}
              type="button"
              className={selected ? "selected" : ""}
              title={isBibliographyEntry(resource.value) ? resource.value.title : resource.key}
              onClick={() => {
                const keys = selected
                  ? citation.keys.filter((key) => key !== resource.key)
                  : [...citation.keys, resource.key];
                if (keys.length > 0) {
                  publish(keys.join(", "));
                }
              }}
            >
              [{resource.ordinal}] {resource.key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface EditableEntry {
  readonly id: string;
  readonly key: string;
  readonly kind: BibliographyEntryKind;
  readonly title: string;
  readonly authors: string;
  readonly year: string;
  readonly venue: string;
  readonly publisher: string;
  readonly doi: string;
  readonly url: string;
}

function toEditable(entry: BuilderBibliographyEntry): EditableEntry {
  return Object.freeze({
    ...entry,
    authors: entry.authors.join("\n"),
    year: entry.year === null ? "" : String(entry.year),
    venue: entry.venue ?? "",
    publisher: entry.publisher ?? "",
    doi: entry.doi ?? "",
    url: entry.url ?? "",
  });
}

function fromEditable(entry: EditableEntry): BuilderBibliographyEntry {
  return createBibliographyEntry({
    id: entry.id,
    key: entry.key,
    kind: entry.kind,
    title: entry.title,
    authors: entry.authors.split(/\r?\n/u).filter((author) => author.length > 0),
    year: entry.year.length === 0 ? null : Number(entry.year),
    venue: entry.venue.length === 0 ? null : entry.venue,
    publisher: entry.publisher.length === 0 ? null : entry.publisher,
    doi: entry.doi.length === 0 ? null : entry.doi,
    url: entry.url.length === 0 ? null : entry.url,
  });
}

function moveEntry(
  entries: readonly EditableEntry[],
  index: number,
  offset: -1 | 1,
): readonly EditableEntry[] {
  const destination = index + offset;
  if (destination < 0 || destination >= entries.length) {
    return entries;
  }
  const result = [...entries];
  const [entry] = result.splice(index, 1);
  if (entry === undefined) {
    return entries;
  }
  result.splice(destination, 0, entry);
  return Object.freeze(result);
}

interface BibliographyEditorProps extends BuilderBlockEditorProps {
  readonly sourceCapability?: BibliographySourceCapability | undefined;
}

function downloadBibliographySource(source: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([source], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BibliographyEditor({
  block,
  onPreview,
  onCommit,
  onCancel,
  documentResources,
  sourceCapability,
}: BibliographyEditorProps) {
  const bibliography = requireBibliographyBlock(block);
  const [entries, setEntries] = useState<readonly EditableEntry[]>(
    bibliography.entries.map(toEditable),
  );
  const [sourceStatus, setSourceStatus] = useState<string | null>(null);
  const bibtexInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const conversion = useMemo(() => {
    try {
      return {
        bibliography: createBibliographyBlock(
          entries.map(fromEditable),
          bibliography.id,
        ),
        error: null,
      } as const;
    } catch (reason: unknown) {
      return {
        bibliography: null,
        error: reason instanceof Error ? reason.message : "Invalid bibliography data",
      } as const;
    }
  }, [bibliography.id, entries]);

  useEffect(() => {
    if (conversion.bibliography !== null) {
      onPreview(conversion.bibliography);
    }
  }, [conversion.bibliography, onPreview]);

  const updateEntry = (entryId: string, update: Partial<EditableEntry>): void => {
    setEntries((current) =>
      Object.freeze(
        current.map((entry) =>
          entry.id === entryId ? Object.freeze({ ...entry, ...update }) : entry,
        ),
      ),
    );
  };

  const consumeSource = (file: File, format: "bibtex" | "json"): void => {
    if (sourceCapability === undefined) {
      return;
    }
    setSourceStatus(`Reading ${file.name}…`);
    void file
      .text()
      .then((source) => {
        const imported =
          format === "bibtex"
            ? sourceCapability.parseBibtex(source)
            : sourceCapability.parseJson(source);
        if (imported.length > 1_000) {
          throw new Error("The graphical editor imports at most 1000 bibliography entries");
        }
        createBibliographyBlock(imported, bibliography.id);
        setEntries(Object.freeze(imported.map(toEditable)));
        setSourceStatus(`Imported ${String(imported.length)} entries from ${file.name}`);
      })
      .catch((reason: unknown) => {
        setSourceStatus(
          reason instanceof Error ? reason.message : "The bibliography source could not be read",
        );
      });
  };

  const preview = conversion.bibliography ?? bibliography;
  return (
    <form
      className="block-editor-form bibliography-editor"
      data-testid="bibliography-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (conversion.bibliography !== null) {
          onCommit(conversion.bibliography);
        }
      }}
    >
      <section className="paragraph-live-preview" aria-label="Live references preview">
        <header>
          <span>Live references preview</span>
          <small>{entries.length} entries</small>
        </header>
        <div>
          <BibliographyPreview
            bibliography={preview}
            context={{ documentResources }}
          />
        </div>
      </section>

      {conversion.error === null ? null : (
        <p className="editor-error">{conversion.error}</p>
      )}

      {sourceCapability === undefined ? null : (
        <section className="bibliography-source-tools" aria-label="Bibliography source adapters">
          <header>
            <div>
              <strong>BibTeX / JSON adapters</strong>
              <small>Import replaces the current normalized record sequence.</small>
            </div>
            <span>{sourceStatus ?? "No source operation yet"}</span>
          </header>
          <input
            ref={bibtexInputRef}
            className="visually-hidden"
            data-testid="bibliography-bibtex-file-input"
            type="file"
            accept=".bib,application/x-bibtex,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) {
                consumeSource(file, "bibtex");
              }
            }}
          />
          <input
            ref={jsonInputRef}
            className="visually-hidden"
            data-testid="bibliography-json-file-input"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) {
                consumeSource(file, "json");
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              bibtexInputRef.current?.click();
            }}
          >
            Load BibTeX…
          </button>
          <button
            type="button"
            onClick={() => {
              jsonInputRef.current?.click();
            }}
          >
            Load JSON…
          </button>
          <button
            type="button"
            data-testid="bibliography-bibtex-export"
            disabled={conversion.bibliography === null}
            onClick={() => {
              try {
                const current = conversion.bibliography;
                if (current === null) {
                  return;
                }
                downloadBibliographySource(
                  sourceCapability.serializeBibtex(current.entries),
                  `${bibliography.id}.bib`,
                  "application/x-bibtex;charset=utf-8",
                );
                setSourceStatus("Exported normalized entries as BibTeX");
              } catch (reason: unknown) {
                setSourceStatus(
                  reason instanceof Error ? reason.message : "BibTeX export failed",
                );
              }
            }}
          >
            Store BibTeX…
          </button>
          <button
            type="button"
            data-testid="bibliography-json-export"
            disabled={conversion.bibliography === null}
            onClick={() => {
              const current = conversion.bibliography;
              if (current === null) {
                return;
              }
              downloadBibliographySource(
                sourceCapability.serializeJson(current.entries),
                `${bibliography.id}.bibliography.json`,
                "application/json;charset=utf-8",
              );
              setSourceStatus("Exported the bespoke bibliography JSON format");
            }}
          >
            Store JSON…
          </button>
        </section>
      )}

      <div className="bibliography-editor__entries">
        {entries.map((entry, index) => (
          <section
            className="bibliography-editor__entry"
            data-bibliography-editor-entry={entry.id}
            key={entry.id}
          >
            <header>
              <strong>Reference {index + 1}</strong>
              <code>{entry.key}</code>
              <button
                type="button"
                disabled={index === 0}
                aria-label={`Move reference ${String(index + 1)} up`}
                onClick={() => {
                  setEntries((current) => moveEntry(current, index, -1));
                }}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index + 1 === entries.length}
                aria-label={`Move reference ${String(index + 1)} down`}
                onClick={() => {
                  setEntries((current) => moveEntry(current, index, 1));
                }}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntries((current) =>
                    Object.freeze(
                      current.filter((candidate) => candidate.id !== entry.id),
                    ),
                  );
                }}
              >
                Remove
              </button>
            </header>
            <div className="bibliography-editor__grid">
              <label>
                <span>Citation key</span>
                <input
                  data-bibliography-key={entry.id}
                  value={entry.key}
                  onChange={(event) => {
                    updateEntry(entry.id, { key: event.target.value });
                  }}
                />
              </label>
              <label>
                <span>Kind</span>
                <select
                  value={entry.kind}
                  onChange={(event) => {
                    updateEntry(entry.id, {
                      kind: event.target.value as BibliographyEntryKind,
                    });
                  }}
                >
                  <option value="article">Article</option>
                  <option value="book">Book</option>
                  <option value="proceedings">Proceedings paper</option>
                  <option value="thesis">Thesis</option>
                  <option value="web">Web</option>
                  <option value="miscellaneous">Miscellaneous</option>
                </select>
              </label>
              <label className="bibliography-editor__wide">
                <span>Title</span>
                <input
                  data-bibliography-title={entry.id}
                  value={entry.title}
                  onChange={(event) => {
                    updateEntry(entry.id, { title: event.target.value });
                  }}
                />
              </label>
              <label className="bibliography-editor__wide">
                <span>Authors · one per line</span>
                <textarea
                  rows={Math.max(2, entry.authors.split("\n").length)}
                  value={entry.authors}
                  onChange={(event) => {
                    updateEntry(entry.id, { authors: event.target.value });
                  }}
                />
              </label>
              {(["year", "venue", "publisher", "doi", "url"] as const).map(
                (field) => (
                  <label
                    key={field}
                    className={field === "url" ? "bibliography-editor__wide" : ""}
                  >
                    <span>
                      {field.charAt(0).toUpperCase() + field.slice(1)} · optional
                    </span>
                    <input
                      type={field === "year" ? "number" : "text"}
                      min={field === "year" ? 0 : undefined}
                      max={field === "year" ? 65_535 : undefined}
                      value={entry[field]}
                      onChange={(event) => {
                        updateEntry(entry.id, { [field]: event.target.value });
                      }}
                    />
                  </label>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      <button
        className="bibliography-editor__add"
        type="button"
        onClick={() => {
          const existing = new Set(entries.map((entry) => entry.key));
          let suffix = entries.length + 1;
          while (existing.has(`reference${String(suffix)}`)) {
            suffix += 1;
          }
          setEntries((current) =>
            Object.freeze([
              ...current,
              toEditable(
                createBibliographyEntry({
                  key: `reference${String(suffix)}`,
                  kind: "miscellaneous",
                  title: "New bibliography entry",
                }),
              ),
            ]),
          );
        }}
      >
        Add reference
      </button>

      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary-action"
          type="submit"
          disabled={conversion.bibliography === null}
        >
          Save references
        </button>
      </div>
    </form>
  );
}
