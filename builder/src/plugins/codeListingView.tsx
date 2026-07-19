// React views used by the graphical code-listing connector.
import { useRef, useState } from "react";

import type {
  BuilderBlockEditorProps,
  BuilderBlockRenderContext,
} from "../builder/plugin";
import type {
  CodeListingBlock,
  CodeListingLanguage,
} from "../model/document";
import {
  codeListingLanguageLabel,
  requireCodeListing,
} from "./codeListingSupport";
import { insertSpacesAtSelection } from "./codeListingEditing";
import { highlightCode } from "./codeHighlighting";

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
  context,
}: Readonly<{
  listing: CodeListingBlock;
  context: BuilderBlockRenderContext;
}>) {
  return (
    <figure className="code-listing-content">
      <div className="code-listing-content__language">
        {codeListingLanguageLabel(listing.language)}
      </div>
      <pre>
        <code data-code-language={listing.language}>
          <HighlightedCode language={listing.language} code={listing.code} />
        </code>
      </pre>
      <figcaption>
        <strong>
          {context.ordinal === null ? "Listing preview:" : `Listing ${String(context.ordinal)}:`}
        </strong>{" "}
        {listing.caption}
      </figcaption>
    </figure>
  );
}

export function CodeListingEditor({ block, onCommit, onCancel }: BuilderBlockEditorProps) {
  const listing = requireCodeListing(block);
  const [language, setLanguage] = useState<CodeListingLanguage>(listing.language);
  const [code, setCode] = useState(listing.code);
  const [caption, setCaption] = useState(listing.caption);
  const highlightRef = useRef<HTMLPreElement>(null);
  const draftListing: CodeListingBlock = Object.freeze({
    ...listing,
    language,
    code,
    caption,
  });

  return (
    <form
      className="block-editor-form code-listing-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onCommit(draftListing);
      }}
    >
      <label className="editor-field">
        <span>Language</span>
        <select
          value={language}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "cpp" || value === "julia") {
              setLanguage(value);
            }
          }}
        >
          <option value="cpp">C++</option>
          <option value="julia">Julia</option>
        </select>
      </label>
      <label className="editor-field">
        <span>Source code</span>
        <div className="code-editor-surface">
          <pre ref={highlightRef} aria-hidden="true">
            <code>
              <HighlightedCode language={language} code={`${code}\n`} />
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
                textarea.setSelectionRange(insertion.selectionStart, insertion.selectionEnd);
              });
            }}
          />
        </div>
      </label>
      <label className="editor-field">
        <span>Caption</span>
        <textarea
          rows={2}
          value={caption}
          onChange={(event) => {
            setCaption(event.target.value);
          }}
        />
      </label>
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary-action"
          type="submit"
          disabled={code.length === 0 || caption.trim().length === 0}
        >
          Save listing
        </button>
      </div>
    </form>
  );
}
