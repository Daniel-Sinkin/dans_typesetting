// Render and directly edit a paragraph while preserving its semantic Inline Sequence.
import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type {
  BuilderInlineEditorProps,
  BuilderInlinePluginRegistry,
  BuilderInlineRenderContext,
} from "../builder/inlinePlugin";
import type { BuilderBlockEditorProps } from "../builder/plugin";
import {
  createBlockId,
  isParagraphBlock,
  isTextInline,
  textInlineTypeId,
  type BuilderBlock,
  type BuilderInlineNode,
  type ParagraphBlock,
  type TextInline,
} from "../model/document";
import { readFileAsDataUrl } from "./imageFile";
import {
  createInlineImage,
  inlineImageTypeId,
} from "./inlineImageModel";
import {
  paragraphAtomIdAttribute,
  paragraphTextIdAttribute,
  paragraphTextStyleAttribute,
  readParagraphComposerInlines,
} from "./paragraphEditing";

function requireParagraph(block: BuilderBlock): ParagraphBlock {
  if (!isParagraphBlock(block)) {
    throw new Error(`Paragraph editor cannot consume ${block.typeId}`);
  }
  return block;
}

export function InlinePayloadEditor({
  inline,
  registry,
  onChange,
  context,
}: BuilderInlineEditorProps) {
  const editor = registry.editorForInline(inline);
  if (editor !== null) {
    return <>{editor.render({ inline, registry, onChange, context })}</>;
  }
  return (
    <div className="inline-payload-opaque">
      <strong>{inline.label ?? "Unsupported inline"}</strong>
      <code>{inline.typeId}</code>
      <small>This connector has no payload editor; the data remains unchanged.</small>
    </div>
  );
}

export function ParagraphPreview({
  paragraph,
  registry,
  context,
}: Readonly<{
  paragraph: ParagraphBlock;
  registry: BuilderInlinePluginRegistry;
  context: BuilderInlineRenderContext;
}>) {
  return (
    <p className="paragraph-content">
      {paragraph.inlines.length === 0 ? (
        <span className="paragraph-content--empty">Empty paragraph</span>
      ) : (
        paragraph.inlines.map((inline) => (
          <Fragment key={inline.id}>
            {registry.adapterForInline(inline).renderPreview(inline, registry, context)}
          </Fragment>
        ))
      )}
    </p>
  );
}

interface ParagraphComposerHandle {
  format(command: "bold" | "italic" | "removeFormat"): void;
  insertInline(inline: BuilderInlineNode): void;
  replaceInline(inline: BuilderInlineNode): void;
  removeInline(inlineId: string): void;
  moveInline(inlineId: string, direction: -1 | 1): void;
}

interface ParagraphComposerProps {
  readonly initialInlines: readonly BuilderInlineNode[];
  readonly registry: BuilderInlinePluginRegistry;
  readonly onChange: (inlines: readonly BuilderInlineNode[]) => void;
  readonly onSelectedInlineChange: (inlineId: string | null) => void;
  readonly onImageFiles: (files: readonly File[]) => void;
}

function createComposerTextNode(inline: TextInline): HTMLSpanElement {
  const span = document.createElement("span");
  span.setAttribute(paragraphTextIdAttribute, inline.id);
  span.setAttribute(paragraphTextStyleAttribute, inline.style);
  span.className = `paragraph-composer__text paragraph-composer__text--${inline.style}`;
  span.textContent = inline.text;
  return span;
}

function atomSummary(
  inline: BuilderInlineNode,
  registry: BuilderInlinePluginRegistry,
): string {
  const summary = registry.adapterForInline(inline).plainText(inline, registry).trim();
  return summary.length === 0 ? inline.typeId : summary;
}

function createComposerAtomNode(
  inline: BuilderInlineNode,
  registry: BuilderInlinePluginRegistry,
): HTMLSpanElement {
  const adapter = registry.adapterForInline(inline);
  const atom = document.createElement("span");
  atom.setAttribute(paragraphAtomIdAttribute, inline.id);
  atom.setAttribute("data-paragraph-inline-type", inline.typeId);
  atom.className = "paragraph-composer__atom";
  atom.contentEditable = "false";
  atom.tabIndex = 0;
  atom.setAttribute("role", "button");
  atom.setAttribute("aria-label", `Edit ${adapter.palette.label}`);
  atom.title = `Click to edit ${adapter.palette.label}`;

  const glyph = document.createElement("span");
  glyph.className = "paragraph-composer__atom-glyph";
  glyph.style.backgroundColor = adapter.palette.accentColor;
  glyph.textContent = adapter.palette.glyph;
  const copy = document.createElement("span");
  copy.className = "paragraph-composer__atom-copy";
  const label = document.createElement("strong");
  label.textContent = adapter.palette.label;
  const summary = document.createElement("small");
  summary.textContent = atomSummary(inline, registry);
  copy.append(label, summary);
  atom.append(glyph, copy);
  return atom;
}

function removeBrowserTextFormatting(fragment: DocumentFragment): void {
  for (const element of fragment.querySelectorAll<HTMLElement>("*")) {
    if (element.hasAttribute(paragraphTextStyleAttribute)) {
      element.setAttribute(paragraphTextStyleAttribute, "normal");
    }
    element.style.removeProperty("font-style");
    element.style.removeProperty("font-weight");
  }
  for (const element of fragment.querySelectorAll("b, strong, i, em")) {
    element.replaceWith(...element.childNodes);
  }
}

function formatSelectedRange(
  range: Range,
  command: "bold" | "italic" | "removeFormat",
): boolean {
  if (range.collapsed) {
    return false;
  }
  const contents = range.extractContents();
  if (command === "removeFormat") {
    removeBrowserTextFormatting(contents);
  }
  const wrapper = document.createElement(
    command === "bold" ? "strong" : command === "italic" ? "em" : "span",
  );
  if (command === "removeFormat") {
    wrapper.setAttribute(paragraphTextStyleAttribute, "normal");
  }
  wrapper.append(contents);
  range.insertNode(wrapper);
  range.selectNodeContents(wrapper);
  return true;
}

const ParagraphComposer = forwardRef<ParagraphComposerHandle, ParagraphComposerProps>(
  function ParagraphComposer(
    {
      initialInlines,
      registry,
      onChange,
      onSelectedInlineChange,
      onImageFiles,
    },
    forwardedRef,
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const initialInlinesRef = useRef(initialInlines);
    const currentInlinesRef = useRef(initialInlines);
    const savedRangeRef = useRef<Range | null>(null);
    const onChangeRef = useRef(onChange);
    const onSelectedInlineChangeRef = useRef(onSelectedInlineChange);
    const onImageFilesRef = useRef(onImageFiles);

    useEffect(() => {
      onChangeRef.current = onChange;
      onSelectedInlineChangeRef.current = onSelectedInlineChange;
      onImageFilesRef.current = onImageFiles;
    }, [onChange, onImageFiles, onSelectedInlineChange]);

    const renderSequence = useCallback(
      (inlines: readonly BuilderInlineNode[]): void => {
        const root = rootRef.current;
        if (root === null) {
          return;
        }
        const fragment = document.createDocumentFragment();
        for (const inline of inlines) {
          fragment.append(
            isTextInline(inline)
              ? createComposerTextNode(inline)
              : createComposerAtomNode(inline, registry),
          );
        }
        root.replaceChildren(fragment);
        savedRangeRef.current = null;
      },
      [registry],
    );

    useLayoutEffect(() => {
      currentInlinesRef.current = initialInlinesRef.current;
      renderSequence(initialInlinesRef.current);
    }, [renderSequence]);

    const rememberSelection = useCallback((): void => {
      const root = rootRef.current;
      const selection = document.getSelection();
      if (
        root === null ||
        selection === null ||
        selection.rangeCount === 0 ||
        selection.anchorNode === null ||
        selection.focusNode === null ||
        !root.contains(selection.anchorNode) ||
        !root.contains(selection.focusNode)
      ) {
        return;
      }
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    }, []);

    useEffect(() => {
      document.addEventListener("selectionchange", rememberSelection);
      return () => {
        document.removeEventListener("selectionchange", rememberSelection);
      };
    }, [rememberSelection]);

    const readCurrentSequence = useCallback((): readonly BuilderInlineNode[] => {
      const root = rootRef.current;
      if (root === null) {
        return currentInlinesRef.current;
      }
      return readParagraphComposerInlines(root, currentInlinesRef.current);
    }, []);

    const publishCurrentSequence = useCallback((): readonly BuilderInlineNode[] => {
      const next = readCurrentSequence();
      currentInlinesRef.current = next;
      onChangeRef.current(next);
      return next;
    }, [readCurrentSequence]);

    const publishRenderedSequence = useCallback(
      (next: readonly BuilderInlineNode[]): void => {
        const frozen = Object.freeze([...next]);
        currentInlinesRef.current = frozen;
        renderSequence(frozen);
        onChangeRef.current(frozen);
      },
      [renderSequence],
    );

    const rangeInsideRoot = useCallback((range: Range, root: HTMLElement): boolean => {
      return root.contains(range.commonAncestorContainer);
    }, []);

    const selectionRangeOrEnd = useCallback((): Range | null => {
      const root = rootRef.current;
      if (root === null) {
        return null;
      }
      const savedRange = savedRangeRef.current;
      if (savedRange !== null && rangeInsideRoot(savedRange, root)) {
        return savedRange.cloneRange();
      }
      const range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
      return range;
    }, [rangeInsideRoot]);

    const selectRange = useCallback((range: Range): void => {
      const selection = document.getSelection();
      if (selection === null) {
        return;
      }
      selection.removeAllRanges();
      selection.addRange(range);
      savedRangeRef.current = range.cloneRange();
    }, []);

    const removeInline = useCallback(
      (inlineId: string): void => {
        const current = readCurrentSequence();
        const next = current.filter((inline) => inline.id !== inlineId);
        if (next.length === current.length) {
          return;
        }
        publishRenderedSequence(next);
        onSelectedInlineChangeRef.current(null);
      },
      [publishRenderedSequence, readCurrentSequence],
    );

    const formatSelection = useCallback(
      (command: "bold" | "italic" | "removeFormat"): void => {
        const root = rootRef.current;
        const range = selectionRangeOrEnd();
        if (root === null || range === null) {
          return;
        }
        root.focus();
        selectRange(range);
        if (formatSelectedRange(range, command)) {
          selectRange(range);
          rememberSelection();
          publishCurrentSequence();
        }
      },
      [publishCurrentSequence, rememberSelection, selectRange, selectionRangeOrEnd],
    );

    const insertPlainText = useCallback(
      (text: string): void => {
        const root = rootRef.current;
        const range = selectionRangeOrEnd();
        if (root === null || range === null) {
          return;
        }
        root.focus();
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selectRange(range);
        rememberSelection();
        publishCurrentSequence();
      },
      [publishCurrentSequence, rememberSelection, selectRange, selectionRangeOrEnd],
    );

    useImperativeHandle(
      forwardedRef,
      () => ({
        format(command) {
          formatSelection(command);
        },
        insertInline(inline) {
          const root = rootRef.current;
          const range = selectionRangeOrEnd();
          if (root === null || range === null) {
            return;
          }
          root.focus();
          range.deleteContents();
          const atom = createComposerAtomNode(inline, registry);
          range.insertNode(atom);
          range.setStartAfter(atom);
          range.collapse(true);
          selectRange(range);
          currentInlinesRef.current = Object.freeze([
            ...currentInlinesRef.current,
            inline,
          ]);
          publishCurrentSequence();
          onSelectedInlineChangeRef.current(inline.id);
        },
        replaceInline(inline) {
          const current = readCurrentSequence();
          if (!current.some((candidate) => candidate.id === inline.id)) {
            return;
          }
          publishRenderedSequence(
            current.map((candidate) => (candidate.id === inline.id ? inline : candidate)),
          );
        },
        removeInline,
        moveInline(inlineId, direction) {
          const current = readCurrentSequence();
          const index = current.findIndex((inline) => inline.id === inlineId);
          const targetIndex = index + direction;
          if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
            return;
          }
          const next = [...current];
          const [moved] = next.splice(index, 1);
          if (moved === undefined) {
            return;
          }
          next.splice(targetIndex, 0, moved);
          publishRenderedSequence(next);
          onSelectedInlineChangeRef.current(inlineId);
        },
      }),
      [
        publishCurrentSequence,
        publishRenderedSequence,
        readCurrentSequence,
        registry,
        formatSelection,
        removeInline,
        selectRange,
        selectionRangeOrEnd,
      ],
    );

    const selectAtomFromTarget = useCallback((target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) {
        return false;
      }
      const atom = target.closest<HTMLElement>(`[${paragraphAtomIdAttribute}]`);
      const root = rootRef.current;
      if (atom === null || root?.contains(atom) !== true) {
        return false;
      }
      const inlineId = atom.getAttribute(paragraphAtomIdAttribute);
      if (inlineId === null) {
        return false;
      }
      const range = document.createRange();
      range.setStartAfter(atom);
      range.collapse(true);
      selectRange(range);
      onSelectedInlineChangeRef.current(inlineId);
      return true;
    }, [selectRange]);

    const handlePaste = (event: ReactClipboardEvent<HTMLDivElement>): void => {
      const imageFiles = [...event.clipboardData.files].filter((file) =>
        file.type.startsWith("image/"),
      );
      if (imageFiles.length > 0) {
        event.preventDefault();
        rememberSelection();
        onImageFilesRef.current(imageFiles);
        return;
      }
      event.preventDefault();
      insertPlainText(event.clipboardData.getData("text/plain"));
    };

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      const atomSelected = selectAtomFromTarget(event.target);
      if (atomSelected && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault();
        const target = event.target;
        if (target instanceof Element) {
          const inlineId = target
            .closest(`[${paragraphAtomIdAttribute}]`)
            ?.getAttribute(paragraphAtomIdAttribute);
          if (inlineId !== null && inlineId !== undefined) {
            removeInline(inlineId);
          }
        }
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "b" || key === "i") {
        event.preventDefault();
        formatSelection(key === "b" ? "bold" : "italic");
      }
    };

    return (
      <div
        ref={rootRef}
        className="paragraph-composer"
        data-testid="paragraph-composer"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Paragraph writing surface"
        aria-multiline="true"
        spellCheck
        onInput={() => {
          rememberSelection();
          publishCurrentSequence();
        }}
        onClick={(event: ReactMouseEvent<HTMLDivElement>) => {
          if (!selectAtomFromTarget(event.target)) {
            onSelectedInlineChangeRef.current(null);
          }
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={rememberSelection}
        onPointerUp={rememberSelection}
        onPaste={handlePaste}
      />
    );
  },
);

interface ParagraphEditorProps extends BuilderBlockEditorProps {
  readonly inlineRegistry: BuilderInlinePluginRegistry;
}

export function ParagraphEditor({
  block,
  inlineRegistry,
  onCommit,
  onCancel,
  onPreview,
  referenceTargets,
  inlineOrdinals,
  documentResources,
}: ParagraphEditorProps) {
  const paragraph = requireParagraph(block);
  const composerRef = useRef<ParagraphComposerHandle>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [inlines, setInlines] = useState<readonly BuilderInlineNode[]>(paragraph.inlines);
  const [selectedInlineId, setSelectedInlineId] = useState<string | null>(null);
  const [readingImages, setReadingImages] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const identity = useState(() => ({ id: paragraph.id, typeId: paragraph.typeId }))[0];

  const draftParagraph = useMemo<ParagraphBlock>(
    () =>
      Object.freeze({
        ...identity,
        inlines: Object.freeze([...inlines]),
      }),
    [identity, inlines],
  );
  const editorContext = useMemo<BuilderInlineRenderContext>(
    () => ({ referenceTargets, inlineOrdinals, documentResources }),
    [documentResources, inlineOrdinals, referenceTargets],
  );
  const insertablePlugins = inlineRegistry
    .palettePlugins()
    .filter(
      (plugin) =>
        plugin.typeId !== textInlineTypeId && plugin.typeId !== inlineImageTypeId,
    );
  const inlineImagesAvailable = inlineRegistry
    .palettePlugins()
    .some((plugin) => plugin.typeId === inlineImageTypeId);
  const selectedInline =
    selectedInlineId === null
      ? null
      : inlines.find((inline) => inline.id === selectedInlineId) ?? null;
  const selectedIndex =
    selectedInline === null
      ? -1
      : inlines.findIndex((inline) => inline.id === selectedInline.id);

  useEffect(() => {
    if (inlines.length > 0) {
      onPreview(draftParagraph);
    }
  }, [draftParagraph, inlines.length, onPreview]);

  const acceptComposerChange = useCallback(
    (nextInlines: readonly BuilderInlineNode[]): void => {
      setInlines(nextInlines);
      setSelectedInlineId((current) =>
        current !== null && nextInlines.some((inline) => inline.id === current)
          ? current
          : null,
      );
    },
    [],
  );

  const insertImageFiles = useCallback(async (files: readonly File[]): Promise<void> => {
    if (!inlineImagesAvailable || files.length === 0) {
      return;
    }
    setReadingImages(true);
    setImageError(null);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} is not an image file`);
        }
        const source = await readFileAsDataUrl(file);
        composerRef.current?.insertInline(createInlineImage(source, 1.15));
      }
    } catch (cause: unknown) {
      setImageError(
        cause instanceof Error ? cause.message : "The image could not be inserted",
      );
    } finally {
      setReadingImages(false);
    }
  }, [inlineImagesAvailable]);

  const preserveComposerSelection = (
    event: ReactMouseEvent<HTMLButtonElement>,
  ): void => {
    event.preventDefault();
  };

  return (
    <form
      className="block-editor-form paragraph-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (inlines.length > 0) {
          onCommit(draftParagraph);
        }
      }}
    >
      <div className="paragraph-editor__workspace">
        <section className="paragraph-writing-panel" aria-label="Paragraph editor">
          <header>
            <div>
              <strong>Write paragraph</strong>
              <small>Type normally, select text to format it, or insert rich content at the caret.</small>
            </div>
            <span>{inlines.length} semantic node{inlines.length === 1 ? "" : "s"}</span>
          </header>
          <div className="paragraph-toolbar" role="toolbar" aria-label="Paragraph tools">
            <div className="paragraph-toolbar__group" aria-label="Text formatting">
              <button
                type="button"
                aria-label="Bold selected text"
                title="Bold · Ctrl/Cmd+B"
                onMouseDown={preserveComposerSelection}
                onClick={() => {
                  composerRef.current?.format("bold");
                }}
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                aria-label="Italicize selected text"
                title="Italic · Ctrl/Cmd+I"
                onMouseDown={preserveComposerSelection}
                onClick={() => {
                  composerRef.current?.format("italic");
                }}
              >
                <em>I</em>
              </button>
              <button
                type="button"
                title="Clear formatting from selected text"
                onMouseDown={preserveComposerSelection}
                onClick={() => {
                  composerRef.current?.format("removeFormat");
                }}
              >
                Clear
              </button>
            </div>
            <div className="paragraph-toolbar__group paragraph-toolbar__inserts" aria-label="Insert inline content">
              {inlineImagesAvailable ? (
                <>
                  <button
                    className="paragraph-toolbar__image"
                    type="button"
                    disabled={readingImages}
                    onMouseDown={preserveComposerSelection}
                    onClick={() => {
                      imageFileInputRef.current?.click();
                    }}
                  >
                    {readingImages ? "Reading image…" : "Image…"}
                  </button>
                  <input
                    ref={imageFileInputRef}
                    className="visually-hidden"
                    data-testid="paragraph-image-file-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                      const files = [...(event.currentTarget.files ?? [])];
                      event.currentTarget.value = "";
                      void insertImageFiles(files);
                    }}
                  />
                </>
              ) : null}
              {insertablePlugins.map((plugin) => (
                <button
                  key={plugin.typeId}
                  type="button"
                  title={plugin.palette.description}
                  data-inline-insert={plugin.typeId}
                  onMouseDown={preserveComposerSelection}
                  onClick={() => {
                    composerRef.current?.insertInline(
                      plugin.createDefault(createBlockId()),
                    );
                  }}
                >
                  <span style={{ backgroundColor: plugin.palette.accentColor }}>
                    {plugin.palette.glyph}
                  </span>
                  {plugin.palette.label}
                </button>
              ))}
            </div>
          </div>
          <ParagraphComposer
            ref={composerRef}
            initialInlines={paragraph.inlines}
            registry={inlineRegistry}
            onChange={acceptComposerChange}
            onSelectedInlineChange={setSelectedInlineId}
            onImageFiles={(files) => {
              void insertImageFiles(files);
            }}
          />
          <small className="paragraph-writing-panel__hint">
            Paste an image to place it at the caret. Rich inline pills stay atomic; click one to edit its details.
          </small>
          {imageError === null ? null : <p className="editor-error">{imageError}</p>}
        </section>

        <aside className="paragraph-inspector" aria-label="Selected inline content">
          {selectedInline === null ? (
            <div className="paragraph-inspector__empty">
              <strong>Inline details</strong>
              <p>Click a math, link, image, reference, code, footnote, colour, or citation pill to edit it here.</p>
            </div>
          ) : (
            <>
              <header>
                <div>
                  <span
                    style={{
                      backgroundColor: inlineRegistry.adapterForInline(selectedInline).palette
                        .accentColor,
                    }}
                  >
                    {inlineRegistry.adapterForInline(selectedInline).palette.glyph}
                  </span>
                  <div>
                    <strong>{inlineRegistry.adapterForInline(selectedInline).palette.label}</strong>
                    <code>{selectedInline.typeId}</code>
                  </div>
                </div>
                <div className="paragraph-inspector__actions">
                  <button
                    type="button"
                    aria-label="Move selected inline left"
                    disabled={selectedIndex <= 0}
                    onClick={() => {
                      composerRef.current?.moveInline(selectedInline.id, -1);
                    }}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label="Move selected inline right"
                    disabled={selectedIndex < 0 || selectedIndex + 1 >= inlines.length}
                    onClick={() => {
                      composerRef.current?.moveInline(selectedInline.id, 1);
                    }}
                  >
                    →
                  </button>
                  <button
                    className="danger-action"
                    type="button"
                    onClick={() => {
                      composerRef.current?.removeInline(selectedInline.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </header>
              <div className="paragraph-inspector__payload">
                <InlinePayloadEditor
                  inline={selectedInline}
                  registry={inlineRegistry}
                  context={editorContext}
                  onChange={(replacement) => {
                    composerRef.current?.replaceInline(replacement);
                  }}
                />
              </div>
            </>
          )}
        </aside>
      </div>

      <section className="paragraph-live-preview" aria-label="Live paragraph preview">
        <header>
          <span>Typeset preview</span>
          <small>Updates while you write</small>
        </header>
        <div>
          <ParagraphPreview
            paragraph={draftParagraph}
            registry={inlineRegistry}
            context={editorContext}
          />
        </div>
      </section>

      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary-action"
          type="submit"
          disabled={inlines.length === 0 || readingImages}
        >
          Save paragraph
        </button>
      </div>
    </form>
  );
}
