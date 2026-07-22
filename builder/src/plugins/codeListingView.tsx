// React views used by the graphical code-listing connector.
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  BuilderInlinePluginRegistry,
  BuilderInlineRenderContext,
} from "../builder/inlinePlugin";
import type { BuilderBlockEditorProps } from "../builder/plugin";
import { editableReferenceIdError } from "../builder/referenceEditing";
import { createText } from "../model/document";
import { insertSpacesAtSelection } from "./codeListingEditing";
import {
  createCodeListingBlock,
  type CodeListingBlock,
  type CodeListingLanguage,
} from "./codeListingModel";
import {
  codeListingLanguageLabel,
  requireCodeListing,
} from "./codeListingSupport";
import { highlightCode } from "./codeHighlighting";
import {
  InlineSequenceEditor,
  InlineSequencePreview,
} from "./inlineSequenceView";

function HighlightedCode({
  language,
  code,
}: Readonly<{ language: CodeListingLanguage; code: string }>) {
  return (
    <>
      {highlightCode(language, code).map((token, index) => (
        <span className={`syntax-token syntax-token--${token.kind}`} key={index}>
          {token.text}
        </span>
      ))}
    </>
  );
}

export function CodeListingPreview({
  listing,
  registry,
  context,
}: Readonly<{
  listing: CodeListingBlock;
  registry: BuilderInlinePluginRegistry;
  context: BuilderInlineRenderContext & Readonly<{ ordinal: number | null }>;
}>) {
  return (
    <figure className="code-listing-content">
      <div className="code-listing-content__language">
        {context.ordinal === null
          ? "Listing preview"
          : `Listing ${String(context.ordinal)}`} {" · "}
        {codeListingLanguageLabel(listing.language)}
      </div>
      <pre>
        <code data-code-language={listing.language}>
          <HighlightedCode
            language={listing.language}
            code={listing.code.replace(/(?:\r?\n)+$/u, "")}
          />
        </code>
      </pre>
      {listing.captionInlines === null ? null : (
        <figcaption>
          <strong>
            {context.ordinal === null
              ? "Listing preview:"
              : `Listing ${String(context.ordinal)}:`}
          </strong>{" "}
          <InlineSequencePreview
            inlines={listing.captionInlines}
            registry={registry}
            context={context}
          />
        </figcaption>
      )}
    </figure>
  );
}

interface CodeListingEditorProps extends BuilderBlockEditorProps {
  readonly inlineRegistry: BuilderInlinePluginRegistry;
}

export function InlineCodeListingEditor({
  block,
  onPreview,
  onCommit,
  onCancel,
}: CodeListingEditorProps) {
  const listing = requireCodeListing(block);
  const [language, setLanguage] = useState<CodeListingLanguage>(listing.language);
  const [code, setCode] = useState(listing.code);
  const highlightRef = useRef<HTMLPreElement>(null);
  const valid = code.length > 0;
  const draftListing = useMemo<CodeListingBlock>(
    () =>
      Object.freeze({
        ...listing,
        language,
        code,
      }),
    [code, language, listing],
  );

  useEffect(() => {
    if (valid) {
      onPreview(draftListing);
    }
  }, [draftListing, onPreview, valid]);

  const save = (): void => {
    if (valid) {
      onCommit(
        createCodeListingBlock(
          draftListing.id,
          draftListing.language,
          draftListing.code,
          draftListing.captionInlines,
          draftListing.referenceId,
        ),
      );
    }
  };

  return (
    <form
      className="inline-code-listing-editor"
      data-testid="inline-code-listing-editor"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.stopPropagation();
          save();
        }
      }}
    >
      <div className="inline-code-listing-editor__toolbar">
        <select
          aria-label="Code language"
          value={language}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "cpp" || value === "cuda" || value === "julia" || value === "raw") {
              setLanguage(value);
            }
          }}
        >
          <option value="cpp">C++</option>
          <option value="cuda">CUDA</option>
          <option value="julia">Julia</option>
          <option value="raw">Raw text</option>
        </select>
        <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> save · <kbd>Esc</kbd> cancel</span>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-action" type="submit" disabled={!valid}>Save</button>
      </div>
      <div className="code-editor-surface inline-code-listing-editor__surface">
        <pre ref={highlightRef} aria-hidden="true">
          <code>
            <HighlightedCode language={language} code={code} />
          </code>
        </pre>
        <textarea
          autoFocus
          className="code-listing-editor__source"
          data-testid="inline-code-listing-source"
          aria-label="Source code"
          spellCheck={false}
          value={code}
          onScroll={(event) => {
            const highlight = highlightRef.current;
            if (highlight !== null) {
              highlight.scrollTop = event.currentTarget.scrollTop;
              highlight.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
          onChange={(event) => {
            setCode(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") {
              return;
            }
            event.preventDefault();
            const textarea = event.currentTarget;
            const insertion = insertSpacesAtSelection(
              textarea.value,
              textarea.selectionStart,
              textarea.selectionEnd,
            );
            setCode(insertion.value);
            globalThis.requestAnimationFrame(() => {
              textarea.setSelectionRange(
                insertion.selectionStart,
                insertion.selectionEnd,
              );
            });
          }}
        />
      </div>
    </form>
  );
}

export function CodeListingEditor({
  block,
  inlineRegistry,
  onPreview,
  onCommit,
  onCancel,
  referenceTargets,
  inlineOrdinals,
  documentResources,
  ordinal,
}: CodeListingEditorProps) {
  const listing = requireCodeListing(block);
  const [language, setLanguage] = useState<CodeListingLanguage>(listing.language);
  const [code, setCode] = useState(listing.code);
  const [captionInlines, setCaptionInlines] = useState(listing.captionInlines);
  const [referenceId, setReferenceId] = useState(listing.referenceId ?? "");
  const highlightRef = useRef<HTMLPreElement>(null);
  const referenceError = editableReferenceIdError(
    referenceId,
    listing.id,
    referenceTargets,
  );
  const valid = code.length > 0 && referenceError === null;
  const draftListing = useMemo<CodeListingBlock>(
    () =>
      Object.freeze({
        id: listing.id,
        typeId: listing.typeId,
        language,
        code,
        captionInlines:
          captionInlines === null
            ? null
            : Object.freeze([...captionInlines]),
        referenceId: referenceId.length === 0 ? null : referenceId,
      }),
    [captionInlines, code, language, listing.id, listing.typeId, referenceId],
  );
  const renderContext = {
    referenceTargets,
    inlineOrdinals,
    documentResources,
    ordinal,
  };

  useEffect(() => {
    if (valid) {
      onPreview(draftListing);
    }
  }, [draftListing, onPreview, valid]);

  return (
    <form
      className="block-editor-form code-listing-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onCommit(
            createCodeListingBlock(
              draftListing.id,
              draftListing.language,
              draftListing.code,
              draftListing.captionInlines,
              draftListing.referenceId,
            ),
          );
        }
      }}
    >
      <section className="code-listing-editor__preview">
        <CodeListingPreview
          listing={draftListing}
          registry={inlineRegistry}
          context={renderContext}
        />
      </section>
      <label className="editor-field">
        <span>Language</span>
        <select
          value={language}
          onChange={(event) => {
            const value = event.target.value;
            if (
              value === "cpp" ||
              value === "cuda" ||
              value === "julia" ||
              value === "raw"
            ) {
              setLanguage(value);
            }
          }}
        >
          <option value="cpp">C++</option>
          <option value="cuda">CUDA</option>
          <option value="julia">Julia</option>
          <option value="raw">Raw text</option>
        </select>
      </label>
      {referenceError === null ? null : (
        <p className="editor-error">{referenceError}</p>
      )}
      <label className="editor-field">
        <span>Reference ID · optional</span>
        <input
          value={referenceId}
          pattern="[A-Za-z][A-Za-z0-9_.:-]*"
          placeholder="lst:solver-kernel"
          onChange={(event) => {
            setReferenceId(event.target.value);
          }}
        />
      </label>
      <label className="editor-field">
        <span>Source code</span>
        <div className="code-editor-surface">
          <pre ref={highlightRef} aria-hidden="true">
            <code>
              <HighlightedCode language={language} code={code} />
            </code>
          </pre>
          <textarea
            className="code-listing-editor__source"
            data-testid="code-listing-source"
            aria-label="Source code"
            rows={14}
            spellCheck={false}
            value={code}
            onScroll={(event) => {
              const highlight = highlightRef.current;
              if (highlight !== null) {
                highlight.scrollTop = event.currentTarget.scrollTop;
                highlight.scrollLeft = event.currentTarget.scrollLeft;
              }
            }}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Tab") {
                return;
              }
              event.preventDefault();
              const textarea = event.currentTarget;
              const insertion = insertSpacesAtSelection(
                textarea.value,
                textarea.selectionStart,
                textarea.selectionEnd,
              );
              setCode(insertion.value);
              globalThis.requestAnimationFrame(() => {
                textarea.setSelectionRange(
                  insertion.selectionStart,
                  insertion.selectionEnd,
                );
              });
            }}
          />
        </div>
      </label>
      {captionInlines === null ? (
        <button
          className="add-caption-action"
          type="button"
          onClick={() => {
            setCaptionInlines([createText("A new listing caption.")]);
          }}
        >
          Add rich caption
        </button>
      ) : (
        <>
          <InlineSequenceEditor
            label="Listing caption"
            inlines={captionInlines}
            registry={inlineRegistry}
            context={renderContext}
            onChange={setCaptionInlines}
          />
          <button
            className="danger-action remove-caption-action"
            type="button"
            onClick={() => {
              setCaptionInlines(null);
            }}
          >
            Remove caption
          </button>
        </>
      )}
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-action" type="submit" disabled={!valid}>
          Save listing
        </button>
      </div>
    </form>
  );
}
