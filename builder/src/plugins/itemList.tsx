// Graphical writer adapter and editor for semantic ordered/unordered lists.
import { Fragment, useEffect, useMemo, useState } from "react";

import type { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import {
  createBlockId,
  createParagraphText,
  type BuilderBlock,
  type BuilderInlineNode,
} from "../model/document";
import { InlinePayloadEditor } from "./paragraphEditor";
import {
  createBuilderListItem,
  moveListEntry,
  requireItemListBlock,
  type BuilderListItem,
  type ItemListBlock,
  type ListPresentation,
} from "./itemListModel";

function ListInlineSequence({
  inlines,
  registry,
}: Readonly<{
  inlines: readonly BuilderInlineNode[];
  registry: BuilderInlinePluginRegistry;
}>) {
  return inlines.map((inline) => (
    <Fragment key={inline.id}>
      {registry.adapterForInline(inline).renderPreview(inline, registry)}
    </Fragment>
  ));
}

export function ItemListPreview({
  list,
  registry,
}: Readonly<{ list: ItemListBlock; registry: BuilderInlinePluginRegistry }>) {
  const children = list.items.map((item) => (
    <li key={item.id} data-list-item-id={item.id}>
      <ListInlineSequence inlines={item.inlines} registry={registry} />
    </li>
  ));
  return list.presentation === "enumerated" ? (
    <ol className="item-list-content" data-list-presentation="enumerated">
      {children}
    </ol>
  ) : (
    <ul className="item-list-content" data-list-presentation="itemized">
      {children}
    </ul>
  );
}

interface ItemListEditorProps {
  readonly block: BuilderBlock;
  readonly inlineRegistry: BuilderInlinePluginRegistry;
  readonly onPreview: (block: BuilderBlock) => void;
  readonly onCommit: (block: BuilderBlock) => void;
  readonly onCancel: () => void;
}

function updateListItem(
  items: readonly BuilderListItem[],
  itemId: string,
  update: (item: BuilderListItem) => BuilderListItem,
): readonly BuilderListItem[] {
  return Object.freeze(items.map((item) => (item.id === itemId ? update(item) : item)));
}

export function ItemListEditor({
  block,
  inlineRegistry,
  onPreview,
  onCommit,
  onCancel,
}: ItemListEditorProps) {
  const list = requireItemListBlock(block);
  const identity = useState(() => ({ id: list.id, typeId: list.typeId }))[0];
  const [presentation, setPresentation] = useState<ListPresentation>(list.presentation);
  const [items, setItems] = useState<readonly BuilderListItem[]>(list.items);
  const draft = useMemo<ItemListBlock>(
    () =>
      Object.freeze({
        ...identity,
        presentation,
        items: Object.freeze([...items]),
      }),
    [identity, items, presentation],
  );
  const valid = items.length > 0 && items.every((item) => item.inlines.length > 0);

  useEffect(() => {
    if (valid) {
      onPreview(draft);
    }
  }, [draft, onPreview, valid]);

  const replaceInline = (
    itemId: string,
    inlineId: string,
    replacement: BuilderInlineNode,
  ): void => {
    if (replacement.id !== inlineId) {
      throw new Error("An inline editor must preserve its stable ID");
    }
    setItems((current) =>
      updateListItem(current, itemId, (item) =>
        createBuilderListItem(
          item.id,
          item.inlines.map((inline) => (inline.id === inlineId ? replacement : inline)),
        ),
      ),
    );
  };

  return (
    <form
      className="block-editor-form item-list-editor"
      data-testid="item-list-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onCommit(draft);
        }
      }}
    >
      <section className="paragraph-live-preview" aria-label="Live list preview">
        <header>
          <span>Live semantic list preview</span>
          <small>{items.length} item{items.length === 1 ? "" : "s"}</small>
        </header>
        <div>
          <ItemListPreview list={draft} registry={inlineRegistry} />
        </div>
      </section>

      <fieldset className="item-list-editor__presentation">
        <legend>Presentation</legend>
        {(["itemized", "enumerated"] as const).map((option) => (
          <label key={option}>
            <input
              type="radio"
              name="list-presentation"
              value={option}
              checked={presentation === option}
              onChange={() => {
                setPresentation(option);
              }}
            />
            <span>{option === "itemized" ? "Bulleted / itemized" : "Numbered / enumerated"}</span>
          </label>
        ))}
      </fieldset>

      <p className="editor-guidance">
        Each item owns a Core Paragraph inline sequence. The list plugin knows only ordering and
        bullet/number presentation; text, colour, links, and mathematics remain independent inline
        extensions.
      </p>

      <div className="item-list-editor__items">
        {items.map((item, itemIndex) => (
          <section className="item-list-editor__item" data-list-editor-item={item.id} key={item.id}>
            <header>
              <strong>Item {itemIndex + 1}</strong>
              <code>{item.id}</code>
              <div>
                <button
                  type="button"
                  aria-label={`Move item ${String(itemIndex + 1)} up`}
                  disabled={itemIndex === 0}
                  onClick={() => {
                    setItems((current) => moveListEntry(current, itemIndex, itemIndex - 1));
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move item ${String(itemIndex + 1)} down`}
                  disabled={itemIndex + 1 === items.length}
                  onClick={() => {
                    setItems((current) => moveListEntry(current, itemIndex, itemIndex + 1));
                  }}
                >
                  ↓
                </button>
                <button
                  className="danger-action"
                  type="button"
                  aria-label={`Remove item ${String(itemIndex + 1)}`}
                  onClick={() => {
                    setItems((current) =>
                      Object.freeze(current.filter((candidate) => candidate.id !== item.id)),
                    );
                  }}
                >
                  Remove item
                </button>
              </div>
            </header>

            <div className="item-list-editor__composed">
              <span>{presentation === "enumerated" ? `${String(itemIndex + 1)}.` : "•"}</span>
              <div>
                <ListInlineSequence inlines={item.inlines} registry={inlineRegistry} />
              </div>
            </div>

            <div className="item-list-editor__segments">
              {item.inlines.map((inline, inlineIndex) => {
                const adapter = inlineRegistry.adapterForInline(inline);
                return (
                  <section
                    className="inline-editor-item"
                    data-list-inline-id={inline.id}
                    key={inline.id}
                  >
                    <header className="inline-editor-item__header">
                      <span
                        className="inline-editor-item__glyph"
                        style={{ background: adapter.palette.accentColor }}
                      >
                        {adapter.palette.glyph}
                      </span>
                      <div>
                        <strong>{adapter.palette.label}</strong>
                        <code>{inline.typeId}</code>
                      </div>
                      <small>Segment {inlineIndex + 1}</small>
                      <div className="item-list-editor__segment-actions">
                        <button
                          type="button"
                          aria-label={`Move segment ${String(inlineIndex + 1)} left`}
                          disabled={inlineIndex === 0}
                          onClick={() => {
                            setItems((current) =>
                              updateListItem(current, item.id, (candidate) =>
                                createBuilderListItem(
                                  candidate.id,
                                  moveListEntry(
                                    candidate.inlines,
                                    inlineIndex,
                                    inlineIndex - 1,
                                  ),
                                ),
                              ),
                            );
                          }}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          aria-label={`Move segment ${String(inlineIndex + 1)} right`}
                          disabled={inlineIndex + 1 === item.inlines.length}
                          onClick={() => {
                            setItems((current) =>
                              updateListItem(current, item.id, (candidate) =>
                                createBuilderListItem(
                                  candidate.id,
                                  moveListEntry(
                                    candidate.inlines,
                                    inlineIndex,
                                    inlineIndex + 1,
                                  ),
                                ),
                              ),
                            );
                          }}
                        >
                          →
                        </button>
                        <button
                          className="danger-action"
                          type="button"
                          aria-label={`Remove segment ${String(inlineIndex + 1)}`}
                          onClick={() => {
                            setItems((current) =>
                              updateListItem(current, item.id, (candidate) =>
                                Object.freeze({
                                  ...candidate,
                                  inlines: Object.freeze(
                                    candidate.inlines.filter(
                                      (entry) => entry.id !== inline.id,
                                    ),
                                  ),
                                }),
                              ),
                            );
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </header>
                    <div className="inline-editor-item__payload">
                      <InlinePayloadEditor
                        inline={inline}
                        registry={inlineRegistry}
                        onChange={(replacement) => {
                          replaceInline(item.id, inline.id, replacement);
                        }}
                      />
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="item-list-editor__add-segment" aria-label={`Add segment to item ${String(itemIndex + 1)}`}>
              <span>Add segment</span>
              {inlineRegistry.palettePlugins().map((plugin) => (
                <button
                  type="button"
                  data-list-add-inline={plugin.typeId}
                  key={plugin.typeId}
                  title={plugin.palette.description}
                  onClick={() => {
                    setItems((current) =>
                      updateListItem(current, item.id, (candidate) =>
                        createBuilderListItem(candidate.id, [
                          ...candidate.inlines,
                          plugin.createDefault(createBlockId()),
                        ]),
                      ),
                    );
                  }}
                >
                  <b style={{ background: plugin.palette.accentColor }}>{plugin.palette.glyph}</b>
                  {plugin.palette.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <button
        className="item-list-editor__add-item"
        type="button"
        onClick={() => {
          setItems((current) =>
            Object.freeze([
              ...current,
              createBuilderListItem(createBlockId(), [
                createParagraphText("A new list item."),
              ]),
            ]),
          );
        }}
      >
        + Add list item
      </button>

      {!valid ? (
        <p className="item-list-editor__invalid">Every saved list requires at least one non-empty item.</p>
      ) : null}

      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-action" type="submit" disabled={!valid}>
          Save list
        </button>
      </div>
    </form>
  );
}
