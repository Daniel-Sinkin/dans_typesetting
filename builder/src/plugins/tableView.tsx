// Graphical preview and rich-cell editor for semantic tables.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import type {
  BuilderInlinePluginRegistry,
  BuilderInlineRenderContext,
} from "../builder/inlinePlugin";
import { editableReferenceIdError } from "../builder/referenceEditing";
import type { BuilderBlockEditorProps } from "../builder/plugin";
import {
  createBlockId,
  createParagraphText,
  type BuilderInlineNode,
} from "../model/document";
import { InlinePayloadEditor } from "./paragraphEditor";
import type { TableCsvCapability } from "./tableCsv";
import {
  createBuilderTableCell,
  createBuilderTableRow,
  requireRichTableBlock,
  type BuilderTableCell,
  type BuilderTableRow,
  type RichTableBlock,
  type TableColumnAlignment,
} from "./tableModel";

function InlineSequencePreview({
  inlines,
  registry,
  context,
}: Readonly<{
  inlines: readonly BuilderInlineNode[];
  registry: BuilderInlinePluginRegistry;
  context: BuilderInlineRenderContext;
}>) {
  return inlines.map((inline) => (
    <Fragment key={inline.id}>
      {registry.adapterForInline(inline).renderPreview(inline, registry, context)}
    </Fragment>
  ));
}

export function TablePreview({
  table,
  registry,
  context,
  ordinal,
}: Readonly<{
  table: RichTableBlock;
  registry: BuilderInlinePluginRegistry;
  context: BuilderInlineRenderContext;
  ordinal: number;
}>) {
  const renderRows = (rows: readonly BuilderTableRow[], header: boolean) =>
    rows.map((row) => (
      <tr data-table-row-id={row.id} key={row.id}>
        {row.cells.map((cell, columnIndex) => {
          const contents = (
            <InlineSequencePreview
              inlines={cell.inlines}
              registry={registry}
              context={context}
            />
          );
          const style = { textAlign: table.columnAlignments[columnIndex] } as const;
          return header ? (
            <th data-table-cell-id={cell.id} key={cell.id} scope="col" style={style}>
              {contents}
            </th>
          ) : (
            <td data-table-cell-id={cell.id} key={cell.id} style={style}>
              {contents}
            </td>
          );
        })}
      </tr>
    ));

  return (
    <figure className="semantic-table-content">
      <div className="semantic-table-content__viewport">
        <table>
          {table.headerRowCount === 0 ? null : (
            <thead>{renderRows(table.rows.slice(0, table.headerRowCount), true)}</thead>
          )}
          <tbody>{renderRows(table.rows.slice(table.headerRowCount), false)}</tbody>
        </table>
      </div>
      <figcaption>
        <strong>Table {ordinal}:</strong>{" "}
        <InlineSequencePreview
          inlines={table.captionInlines}
          registry={registry}
          context={context}
        />
      </figcaption>
    </figure>
  );
}

interface TableInlineSequenceEditorProps {
  readonly label: string;
  readonly inlines: readonly BuilderInlineNode[];
  readonly registry: BuilderInlinePluginRegistry;
  readonly context: BuilderInlineRenderContext;
  readonly onChange: (inlines: readonly BuilderInlineNode[]) => void;
}

function moveEntry<T>(entries: readonly T[], from: number, to: number): readonly T[] {
  if (to < 0 || to >= entries.length) {
    return entries;
  }
  const moved = [...entries];
  const [entry] = moved.splice(from, 1);
  if (entry === undefined) {
    return entries;
  }
  moved.splice(to, 0, entry);
  return Object.freeze(moved);
}

function TableInlineSequenceEditor({
  label,
  inlines,
  registry,
  context,
  onChange,
}: TableInlineSequenceEditorProps) {
  return (
    <section className="table-inline-editor">
      <header>
        <div>
          <strong>{label}</strong>
          <small>Ordered Core Paragraph inline sequence</small>
        </div>
        <div className="table-inline-editor__composed">
          <InlineSequencePreview inlines={inlines} registry={registry} context={context} />
        </div>
      </header>
      <div className="table-inline-editor__segments">
        {inlines.map((inline, index) => {
          const adapter = registry.adapterForInline(inline);
          return (
            <section data-table-inline-id={inline.id} key={inline.id}>
              <header>
                <b style={{ background: adapter.palette.accentColor }}>
                  {adapter.palette.glyph}
                </b>
                <strong>{adapter.palette.label}</strong>
                <code>{inline.typeId}</code>
                <button
                  type="button"
                  aria-label={`Move table segment ${String(index + 1)} left`}
                  disabled={index === 0}
                  onClick={() => {
                    onChange(moveEntry(inlines, index, index - 1));
                  }}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={`Move table segment ${String(index + 1)} right`}
                  disabled={index + 1 === inlines.length}
                  onClick={() => {
                    onChange(moveEntry(inlines, index, index + 1));
                  }}
                >
                  →
                </button>
                <button
                  className="danger-action"
                  type="button"
                  disabled={inlines.length === 1}
                  onClick={() => {
                    onChange(inlines.filter((candidate) => candidate.id !== inline.id));
                  }}
                >
                  Remove
                </button>
              </header>
              <InlinePayloadEditor
                inline={inline}
                registry={registry}
                context={context}
                onChange={(replacement) => {
                  if (replacement.id !== inline.id) {
                    throw new Error("A table inline editor must preserve stable identity");
                  }
                  onChange(
                    inlines.map((candidate) =>
                      candidate.id === inline.id ? replacement : candidate,
                    ),
                  );
                }}
              />
            </section>
          );
        })}
      </div>
      <div className="table-inline-editor__add">
        <span>Add segment</span>
        {registry.palettePlugins().map((plugin) => (
          <button
            type="button"
            data-table-add-inline={plugin.typeId}
            key={plugin.typeId}
            title={plugin.palette.description}
            onClick={() => {
              onChange([...inlines, plugin.createDefault(createBlockId())]);
            }}
          >
            <b style={{ background: plugin.palette.accentColor }}>
              {plugin.palette.glyph}
            </b>
            {plugin.palette.label}
          </button>
        ))}
      </div>
    </section>
  );
}

type TableSelection =
  | Readonly<{ kind: "caption" }>
  | Readonly<{ kind: "cell"; cellId: string }>;

interface TableEditorProps extends BuilderBlockEditorProps {
  readonly inlineRegistry: BuilderInlinePluginRegistry;
  readonly csvCapability?: TableCsvCapability | undefined;
}

function replaceCell(
  rows: readonly BuilderTableRow[],
  cellId: string,
  update: (cell: BuilderTableCell) => BuilderTableCell,
): readonly BuilderTableRow[] {
  return Object.freeze(
    rows.map((row) =>
      createBuilderTableRow(
        row.id,
        row.cells.map((cell) => (cell.id === cellId ? update(cell) : cell)),
      ),
    ),
  );
}

function makeTextCell(text = "New cell"): BuilderTableCell {
  return createBuilderTableCell(createBlockId(), [createParagraphText(text)]);
}

function downloadCsv(source: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([source], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TableEditor({
  block,
  inlineRegistry,
  csvCapability,
  onPreview,
  onCommit,
  onCancel,
  referenceTargets,
  inlineOrdinals,
  ordinal,
}: TableEditorProps) {
  const table = requireRichTableBlock(block);
  const identity = useState(() => ({ id: table.id, typeId: table.typeId }))[0];
  const [captionInlines, setCaptionInlines] = useState(table.captionInlines);
  const [referenceId, setReferenceId] = useState(table.referenceId ?? "");
  const [headerRowCount, setHeaderRowCount] = useState(table.headerRowCount);
  const [columnAlignments, setColumnAlignments] = useState(table.columnAlignments);
  const [rows, setRows] = useState(table.rows);
  const [selection, setSelection] = useState<TableSelection>({ kind: "caption" });
  const [csvMaximumRows, setCsvMaximumRows] = useState(30);
  const [csvFirstRowHeader, setCsvFirstRowHeader] = useState(true);
  const [csvStatus, setCsvStatus] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const referenceError = editableReferenceIdError(
    referenceId,
    table.id,
    referenceTargets,
  );
  const valid =
    referenceError === null &&
    captionInlines.length > 0 &&
    rows.length > 0 &&
    columnAlignments.length > 0 &&
    rows.every(
      (row) =>
        row.cells.length === columnAlignments.length &&
        row.cells.every((cell) => cell.inlines.length > 0),
    );
  const draft = useMemo<RichTableBlock>(
    () =>
      Object.freeze({
        ...identity,
        captionInlines: Object.freeze([...captionInlines]),
        referenceId: referenceId.length === 0 ? null : referenceId,
        headerRowCount,
        columnAlignments: Object.freeze([...columnAlignments]),
        rows: Object.freeze([...rows]),
      }),
    [
      captionInlines,
      columnAlignments,
      headerRowCount,
      identity,
      referenceId,
      rows,
    ],
  );
  const renderContext = { referenceTargets, inlineOrdinals };
  const selectedCell =
    selection.kind === "cell"
      ? rows.flatMap((row) => row.cells).find((cell) => cell.id === selection.cellId)
      : undefined;
  const activeSelection: TableSelection =
    selection.kind === "cell" && selectedCell === undefined
      ? { kind: "caption" }
      : selection;

  useEffect(() => {
    if (valid) {
      onPreview(draft);
    }
  }, [draft, onPreview, valid]);

  const replaceSelectedInlines = (inlines: readonly BuilderInlineNode[]): void => {
    if (activeSelection.kind === "caption") {
      setCaptionInlines(Object.freeze([...inlines]));
      return;
    }
    setRows((current) =>
      replaceCell(current, activeSelection.cellId, (cell) =>
        createBuilderTableCell(cell.id, inlines),
      ),
    );
  };

  const consumeCsvFile = (file: File): void => {
    if (csvCapability === undefined) {
      return;
    }
    setCsvStatus(`Reading ${file.name}…`);
    void file
      .text()
      .then((source) => {
        const parsed = csvCapability.parse(source, csvMaximumRows);
        const importedRows = parsed.map((values) =>
          createBuilderTableRow(
            createBlockId(),
            values.map((value) => makeTextCell(value)),
          ),
        );
        const columnCount = parsed[0]?.length ?? 0;
        setRows(Object.freeze(importedRows));
        setColumnAlignments(
          Object.freeze(
            Array.from({ length: columnCount }, () => "left" as const),
          ),
        );
        setHeaderRowCount(csvFirstRowHeader ? 1 : 0);
        setSelection({ kind: "caption" });
        setCsvStatus(`Imported ${String(parsed.length)} rows from ${file.name}`);
      })
      .catch((reason: unknown) => {
        setCsvStatus(
          reason instanceof Error ? reason.message : "The CSV file could not be read",
        );
      });
  };

  return (
    <form
      className="block-editor-form table-editor"
      data-testid="table-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onCommit(requireRichTableBlock(draft));
        }
      }}
    >
      <section className="paragraph-live-preview" aria-label="Live table preview">
        <header>
          <span>Live semantic table preview</span>
          <small>
            {rows.length} × {columnAlignments.length}
          </small>
        </header>
        <div>
          <TablePreview
            table={draft}
            registry={inlineRegistry}
            context={renderContext}
            ordinal={ordinal ?? 0}
          />
        </div>
      </section>

      <div className="table-editor__metadata">
        {referenceError === null ? null : (
          <p className="editor-error">{referenceError}</p>
        )}
        <label className="editor-field">
          <span>Reference ID · optional</span>
          <input
            data-table-reference-id
            value={referenceId}
            pattern="[A-Za-z][A-Za-z0-9_.:-]*"
            placeholder="tab:kernel-runtime"
            onChange={(event) => {
              setReferenceId(event.target.value);
            }}
          />
        </label>
        <label className="table-editor__header-toggle">
          <input
            type="checkbox"
            checked={headerRowCount !== 0}
            onChange={(event) => {
              setHeaderRowCount(event.target.checked ? 1 : 0);
            }}
          />
          <span>First row is a semantic header</span>
        </label>
        <button
          type="button"
          className={activeSelection.kind === "caption" ? "selected" : ""}
          onClick={() => {
            setSelection({ kind: "caption" });
          }}
        >
          Edit caption sequence
        </button>
      </div>

      {csvCapability === undefined ? null : (
        <section className="table-csv-tools" aria-label="CSV extension controls">
          <header>
            <div>
              <strong>CSV extension</strong>
              <small>Optional plain-text adapter; rich cells remain table data.</small>
            </div>
            <span>{csvStatus ?? "No CSV operation yet"}</span>
          </header>
          <input
            ref={csvInputRef}
            className="visually-hidden"
            data-testid="table-csv-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) {
                consumeCsvFile(file);
              }
            }}
          />
          <label>
            <span>Maximum imported rows</span>
            <input
              type="number"
              min="1"
              max="30"
              value={csvMaximumRows}
              onChange={(event) => {
                setCsvMaximumRows(
                  Math.max(1, Math.min(30, Number(event.target.value))),
                );
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={csvFirstRowHeader}
              onChange={(event) => {
                setCsvFirstRowHeader(event.target.checked);
              }}
            />
            <span>Imported first row is a header</span>
          </label>
          <button
            type="button"
            onClick={() => {
              csvInputRef.current?.click();
            }}
          >
            Load CSV…
          </button>
          <button
            type="button"
            data-testid="table-csv-export"
            onClick={() => {
              try {
                downloadCsv(
                  csvCapability.serialize(draft, inlineRegistry),
                  `${table.id}.csv`,
                );
                setCsvStatus("Exported the plain-text table projection");
              } catch (reason: unknown) {
                setCsvStatus(
                  reason instanceof Error ? reason.message : "CSV export failed",
                );
              }
            }}
          >
            Store CSV…
          </button>
        </section>
      )}

      <section className="table-grid-editor">
        <header>
          <div>
            <strong>Grid structure</strong>
            <small>Select a cell to edit its inline sequence below.</small>
          </div>
          <button
            type="button"
            onClick={() => {
              setRows((current) =>
                Object.freeze([
                  ...current,
                  createBuilderTableRow(
                    createBlockId(),
                    columnAlignments.map(() => makeTextCell()),
                  ),
                ]),
              );
            }}
          >
            + Row
          </button>
          <button
            type="button"
            onClick={() => {
              setColumnAlignments((current) => Object.freeze([...current, "left"]));
              setRows((current) =>
                Object.freeze(
                  current.map((row) =>
                    createBuilderTableRow(row.id, [...row.cells, makeTextCell()]),
                  ),
                ),
              );
            }}
          >
            + Column
          </button>
        </header>
        <div className="table-grid-editor__viewport">
          <table>
            <thead>
              <tr>
                <th aria-label="Row actions" />
                {columnAlignments.map((alignment, columnIndex) => (
                  <th key={`column-${String(columnIndex)}`}>
                    <span>Column {columnIndex + 1}</span>
                    <select
                      aria-label={`Column ${String(columnIndex + 1)} alignment`}
                      value={alignment}
                      onChange={(event) => {
                        const next = event.target.value as TableColumnAlignment;
                        setColumnAlignments((current) =>
                          Object.freeze(
                            current.map((candidate, index) =>
                              index === columnIndex ? next : candidate,
                            ),
                          ),
                        );
                      }}
                    >
                      <option value="left">Left</option>
                      <option value="center">Centre</option>
                      <option value="right">Right</option>
                    </select>
                    <button
                      type="button"
                      aria-label={`Remove column ${String(columnIndex + 1)}`}
                      disabled={columnAlignments.length === 1}
                      onClick={() => {
                        const removedCellIds = new Set(
                          rows.map((row) => row.cells[columnIndex]?.id),
                        );
                        setColumnAlignments((current) =>
                          Object.freeze(
                            current.filter((_, index) => index !== columnIndex),
                          ),
                        );
                        setRows((current) =>
                          Object.freeze(
                            current.map((row) =>
                              createBuilderTableRow(
                                row.id,
                                row.cells.filter((_, index) => index !== columnIndex),
                              ),
                            ),
                          ),
                        );
                        if (
                          selection.kind === "cell" &&
                          removedCellIds.has(selection.cellId)
                        ) {
                          setSelection({ kind: "caption" });
                        }
                      }}
                    >
                      ×
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr data-table-editor-row={row.id} key={row.id}>
                  <th>
                    <span>{rowIndex + 1}</span>
                    <button
                      type="button"
                      aria-label={`Move table row ${String(rowIndex + 1)} up`}
                      disabled={rowIndex === 0}
                      onClick={() => {
                        setRows((current) => moveEntry(current, rowIndex, rowIndex - 1));
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move table row ${String(rowIndex + 1)} down`}
                      disabled={rowIndex + 1 === rows.length}
                      onClick={() => {
                        setRows((current) => moveEntry(current, rowIndex, rowIndex + 1));
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove table row ${String(rowIndex + 1)}`}
                      disabled={rows.length === 1}
                      onClick={() => {
                        setRows((current) =>
                          Object.freeze(
                            current.filter((candidate) => candidate.id !== row.id),
                          ),
                        );
                        setHeaderRowCount((current) =>
                          Math.min(current, rows.length - 1),
                        );
                      }}
                    >
                      ×
                    </button>
                  </th>
                  {row.cells.map((cell, columnIndex) => (
                    <td key={cell.id}>
                      <button
                        type="button"
                        data-table-editor-cell={cell.id}
                        className={
                          selection.kind === "cell" && selection.cellId === cell.id
                            ? "selected"
                            : ""
                        }
                        style={{ textAlign: columnAlignments[columnIndex] }}
                        onClick={() => {
                          setSelection({ kind: "cell", cellId: cell.id });
                        }}
                      >
                        <InlineSequencePreview
                          inlines={cell.inlines}
                          registry={inlineRegistry}
                          context={renderContext}
                        />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <TableInlineSequenceEditor
        label={
          activeSelection.kind === "caption"
            ? "Table caption"
            : `Selected cell · ${activeSelection.cellId}`
        }
        inlines={
          activeSelection.kind === "caption"
            ? captionInlines
            : (selectedCell?.inlines ?? captionInlines)
        }
        registry={inlineRegistry}
        context={renderContext}
        onChange={replaceSelectedInlines}
      />

      {!valid ? (
        <p className="editor-error">
          A saved table must remain rectangular with at least one row, column, caption segment,
          and cell segment.
        </p>
      ) : null}
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-action" type="submit" disabled={!valid}>
          Save table
        </button>
      </div>
    </form>
  );
}
