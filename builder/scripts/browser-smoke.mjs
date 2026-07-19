// Exercise the real Excalidraw/document interaction seam in an installed headless Chrome.
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const builderDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const resultsDirectory = join(builderDirectory, "test-results");
const sampleImagePath = join(
  builderDirectory,
  "public",
  "sample-domain-decomposition.svg",
);
const canonicalFixturePath = join(
  builderDirectory,
  "..",
  "fixtures",
  "canonical",
  "current-features.dans.json",
);
const initialBlockCount = 10;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  if (address === null || typeof address === "string") {
    throw new Error("Could not reserve a browser-test port");
  }
  return address.port;
}

async function waitForJson(url, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // The process is still starting.
    }
    await delay(80);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForHttp(url, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // The process is still starting.
    }
    await delay(80);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function installedChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter((candidate) => typeof candidate === "string");
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next common executable.
    }
  }
  throw new Error("No Chrome executable found; set CHROME_BIN to run the browser smoke test");
}

class CdpClient {
  #socket;
  #nextId = 1;
  #pending = new Map();
  exceptions = [];
  consoleCalls = [];

  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const completion = this.#pending.get(message.id);
        if (completion !== undefined) {
          this.#pending.delete(message.id);
          completion(message);
        }
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.exceptions.push(message.params.exceptionDetails.text);
      }
      if (message.method === "Runtime.consoleAPICalled") {
        this.consoleCalls.push(
          message.params.args.map((argument) => argument.value ?? argument.description ?? "").join(" "),
        );
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.#nextId;
      this.#nextId += 1;
      this.#pending.set(id, (message) => {
        if (message.error === undefined) {
          resolve(message.result);
        } else {
          reject(new Error(`${method}: ${JSON.stringify(message.error)}`));
        }
      });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true });
    if (result.exceptionDetails !== undefined) {
      throw new Error(`Browser evaluation failed: ${result.exceptionDetails.text}`);
    }
    return result.result.value;
  }

  close() {
    this.#socket.close();
  }
}

async function waitForBuilder(client) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    try {
      const ready = await client.evaluate(
        `document.querySelectorAll("[data-block-id]").length >= ${String(initialBlockCount)} && document.querySelector(".document-page") !== null`,
      );
      if (ready) {
        return;
      }
    } catch {
      // The previous JavaScript context may be disappearing during reload.
    }
    await delay(60);
  }
  throw new Error(
    `The document builder did not become ready${client.exceptions.length === 0 ? "" : `: ${client.exceptions.join("; ")}`}`,
  );
}

async function reloadBuilder(client) {
  await client.send("Page.reload", { ignoreCache: true });
  await delay(250);
  await waitForBuilder(client);
  await delay(700);
}

async function screenshot(client, filename) {
  const capture = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(join(resultsDirectory, filename), Buffer.from(capture.data, "base64"));
}

async function pointerDrag(client, start, end, modifiers = 0) {
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: start.x,
    y: start.y,
    modifiers,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: start.x,
    y: start.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
    modifiers,
  });
  await delay(70);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: end.x,
    y: end.y,
    button: "left",
    buttons: 1,
    modifiers,
  });
  await delay(90);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: end.x,
    y: end.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
    modifiers,
  });
  await delay(100);
}

async function pointerClick(client, point, button = "left") {
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button,
    buttons: button === "left" ? 1 : 2,
    clickCount: 1,
  });
  await delay(90);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button,
    buttons: 0,
    clickCount: 1,
  });
  await delay(80);
}

async function pressKey(client, key, code = key) {
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key, code });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
  await delay(50);
}

async function exerciseBuilder(client) {
  await client.send("Runtime.enable");
  await client.send("DOM.enable");
  await client.send("Page.enable");
  await waitForBuilder(client);
  await delay(700);

  const initial = await client.evaluate(`(() => {
    const image = document.querySelector(".image-content img");
    const layers = [
      document.querySelector(".document-visual-layer"),
      document.querySelector(".excalidraw"),
      document.querySelector(".document-control-layer"),
    ];
    return {
      blocks: document.querySelectorAll("[data-block-id]").length,
      imageLoaded: image instanceof HTMLImageElement && image.complete && image.naturalWidth === 1280,
      structuredMath: document.querySelector("[data-visual-block-id='sample-display-math'] .math-node") !== null,
      summation: document.querySelector("[data-visual-block-id='sample-display-math'] .math-summation-symbol")?.textContent === "∑",
      codeListing: document.querySelector("[data-visual-block-id='sample-code-listing'] code")?.textContent.includes("std::println") ?? false,
      opaqueFallback: document.body.textContent.includes("dans.future.table"),
      inlineMath: document.querySelector("[data-inline-math-id='sample-introduction-inline-math'] .math-node") !== null,
      hyperlink: document.querySelector("a[href='https://example.com/typesetting']")?.textContent.includes("clickable links") ?? false,
      styledText: document.querySelector("[data-visual-block-id='sample-introduction'] strong em")?.textContent === "Styled text",
      figureNumber: document.querySelector("[data-visual-block-id='sample-figure'] figcaption")?.textContent.includes("Figure 1:") ?? false,
      equationNumber: document.querySelector("[data-visual-block-id='sample-display-math'] .math-equation-number")?.textContent === "(1)",
      listingNumber: document.querySelector("[data-visual-block-id='sample-code-listing'] figcaption")?.textContent.includes("Listing 1:") ?? false,
      layers: layers.map((layer) => layer === null ? null : getComputedStyle(layer).zIndex),
    };
  })()`);
  assert(initial.blocks === initialBlockCount, "Expected all initial document blocks");
  assert(initial.imageLoaded, "The real sample image did not load");
  assert(initial.structuredMath, "Structured display math was not rendered");
  assert(initial.summation, "Structured summation was not rendered");
  assert(initial.codeListing, "The C++ code-listing plugin was not rendered");
  assert(initial.opaqueFallback, "The opaque block fallback was not rendered");
  assert(initial.inlineMath, "Structured inline mathematics was not rendered");
  assert(initial.hyperlink, "The semantic hyperlink was not rendered as a clickable link");
  assert(initial.styledText, "Styled Core Text was not rendered");
  assert(initial.figureNumber && initial.equationNumber && initial.listingNumber, "Live numbering is incorrect");
  assert(JSON.stringify(initial.layers) === JSON.stringify(["1", "2", "3"]), "Canvas layering is incorrect");

  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-opaque-table']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(30);
  assert(
    client.consoleCalls.some((message) => message.includes("Trying to Edit")),
    "Unsupported editing did not report the stable handle",
  );

  await screenshot(client, "document-builder.png");

  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-section']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(80);
  await client.evaluate(`(() => {
    const dialog = document.querySelector("[data-testid='block-editor-dialog']");
    const inputs = dialog.querySelectorAll("input");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(inputs[0], "Renamed document structure");
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    setter.call(inputs[1], "sec:renamed-structure");
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    [...dialog.querySelectorAll("button")].find((button) => button.textContent.includes("Save section")).click();
  })()`);
  await delay(100);
  assert(
    await client.evaluate(`(() => {
      const section = document.querySelector("[data-visual-block-id='sample-section']");
      const toc = document.querySelector(".toc-content");
      return section.textContent.includes("Renamed document structure") &&
        section.textContent.includes("sec:renamed-structure") &&
        toc.textContent.includes("Renamed document structure");
    })()`),
    "Section editing did not update the heading and live table of contents",
  );

  const nestingPoints = await client.evaluate(`(() => {
    const grip = document.querySelector("[data-block-id='sample-introduction'] .document-block__grip").getBoundingClientRect();
    const section = document.querySelector("[data-visual-block-id='sample-section']").getBoundingClientRect();
    return {
      start: { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 },
      end: { x: section.x + 90, y: section.bottom + 16 },
    };
  })()`);
  await pointerDrag(client, nestingPoints.start, nestingPoints.end);
  assert(
    await client.evaluate(`document.querySelector("[data-block-id='sample-introduction']")?.dataset.sectionDepth === "1"`),
    "Dragging a root block into a section did not preserve nested ownership",
  );

  await reloadBuilder(client);

  await client.evaluate(`(() => {
    const select = document.querySelector("select[data-testid='layout-mode']");
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(select, "paged");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await delay(650);
  const pagedLayout = await client.evaluate(`(() => {
    const pages = [...document.querySelectorAll(".document-page")];
    const pageBounds = pages.map((page) => page.getBoundingClientRect());
    const blocks = [...document.querySelectorAll("[data-visual-block-id]")];
    const contained = blocks.every((block) => {
      const bounds = block.getBoundingClientRect();
      return pageBounds.some((page) =>
        bounds.left >= page.left - 1 && bounds.right <= page.right + 1 &&
        bounds.top >= page.top - 1 && bounds.bottom <= page.bottom + 1
      );
    });
    return {
      pageCount: pages.length,
      firstPage: pages[0]?.dataset.pageNumber,
      contained,
    };
  })()`);
  assert(
    pagedLayout.pageCount >= 2 && pagedLayout.pageCount <= 5,
    "Paged mode did not project the bounded page range",
  );
  assert(pagedLayout.firstPage === "1", "Paged mode did not begin with page one");
  assert(pagedLayout.contained, "Paged mode split or overflowed an ordinary block");
  await client.evaluate(`(() => {
    const input = document.querySelector("input[data-testid='page-range-start']");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "2");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await delay(650);
  assert(
    await client.evaluate(`document.querySelector(".document-page")?.dataset.pageNumber === "2"`),
    "Page-range selection did not move the projected slice",
  );
  await screenshot(client, "paged-document-range.png");

  await reloadBuilder(client);

  await client.evaluate(`document.querySelector("input[aria-label='Rectangle']").click()`);
  const drawingBounds = await client.evaluate(`(() => {
    const bounds = document.querySelector("[data-visual-block-id='sample-display-math']").getBoundingClientRect();
    return {
      start: { x: bounds.x + 120, y: bounds.y + 45 },
      end: { x: bounds.right - 80, y: bounds.bottom - 28 },
    };
  })()`);
  await pointerDrag(client, drawingBounds.start, drawingBounds.end);
  assert(
    !(await client.evaluate(`document.querySelector("button[aria-label='Undo']").disabled`)),
    "Excalidraw did not receive drawing input over the document",
  );
  await screenshot(client, "drawing-over-document.png");

  await reloadBuilder(client);
  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-introduction']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(80);
  await client.evaluate(`(() => {
    const textarea = document.querySelector("textarea[data-inline-id='sample-introduction-text-a']");
    const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    textareaSetter.call(textarea, "Edited by the browser smoke test. ");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    const color = document.querySelector("input[data-color-span-id='sample-introduction-colour']");
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    inputSetter.call(color, "#c92a2a");
    color.dispatchEvent(new Event("input", { bubbles: true }));
    const style = document.querySelector("select[data-inline-style-id='sample-introduction-styled-text']");
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    selectSetter.call(style, "italic");
    style.dispatchEvent(new Event("change", { bubbles: true }));
    const hyperlink = document.querySelector("input[data-hyperlink-id='sample-introduction-link']");
    inputSetter.call(hyperlink, "www.google.com");
    hyperlink.dispatchEvent(new Event("input", { bubbles: true }));
    const hyperlinkLabel = document.querySelector("textarea[data-inline-id='sample-introduction-link-label']");
    textareaSetter.call(hyperlinkLabel, "updated link");
    hyperlinkLabel.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await delay(80);
  const paragraphLive = await client.evaluate(`(() => {
    const preview = document.querySelector(".paragraph-live-preview");
    const colour = preview.querySelector(".inline-color-span");
    return {
      text: preview.textContent.includes("Edited by the browser smoke test"),
      colour: getComputedStyle(colour).color,
      segments: document.querySelectorAll("[data-inline-editor-id]").length,
      inlineMathEditor: document.querySelector(".inline-math-editor .math-editor-canvas") !== null,
      hyperlink: preview.querySelector("a[href='https://www.google.com']")?.textContent === "updated link",
      styled: preview.querySelector("em")?.textContent === "Styled text",
    };
  })()`);
  assert(paragraphLive.text, "Paragraph live preview did not update before save");
  assert(paragraphLive.colour === "rgb(201, 42, 42)", "Colour-span preview did not update");
  assert(paragraphLive.segments === 8, "The paragraph did not expose all inline segments");
  assert(paragraphLive.inlineMathEditor, "Inline structured math did not expose its graphical editor");
  assert(paragraphLive.hyperlink, "Hyperlink target and label did not live-update");
  assert(paragraphLive.styled, "Core Text style did not live-update");

  const addSegmentPoints = await client.evaluate(`(() => {
    const center = (element) => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    };
    const sequence = document.querySelector(".inline-editor-sequence").getBoundingClientRect();
    return {
      start: center(document.querySelector("[data-inline-palette='dans.core.text']")),
      end: { x: sequence.x + sequence.width / 2, y: sequence.bottom - 3 },
    };
  })()`);
  await pointerDrag(client, addSegmentPoints.start, addSegmentPoints.end);
  const addedInlineId = await client.evaluate(`(() => {
    const items = [...document.querySelectorAll("[data-inline-editor-id]")];
    return items.length === 9 ? items.at(-1).dataset.inlineEditorId : null;
  })()`);
  assert(addedInlineId !== null, "Dragging from the inline palette did not add a segment");

  const reorderSegmentPoints = await client.evaluate(`(() => {
    const center = (element) => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    };
    const grip = document.querySelector("[data-inline-grip-id='${addedInlineId}']");
    grip.scrollIntoView({ block: "center" });
    const items = [...document.querySelectorAll("[data-inline-editor-id]")];
    const previous = items.at(-2).getBoundingClientRect();
    return {
      start: center(grip),
      end: { x: previous.x + previous.width / 2, y: previous.y + 2 },
    };
  })()`);
  await pointerDrag(client, reorderSegmentPoints.start, reorderSegmentPoints.end);
  assert(
    (await client.evaluate(`[
      ...document.querySelectorAll("[data-inline-editor-id]")
    ].at(-2).dataset.inlineEditorId`)) === addedInlineId,
    "Inline segment drag did not reorder the paragraph sequence",
  );
  await client.evaluate(`(() => {
    const item = document.querySelector("[data-inline-editor-id='${addedInlineId}']");
    [...item.querySelectorAll("button")].find((button) => button.textContent.trim() === "Remove").click();
    [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Save paragraph")).click();
  })()`);
  const paragraphEdited = await client.evaluate(
    `document.querySelector("[data-visual-block-id='sample-introduction']").textContent.includes("Edited by the browser smoke test")`,
  );
  assert(paragraphEdited, "Paragraph sequence-text editing did not commit");

  await reloadBuilder(client);
  await client.evaluate(`localStorage.removeItem("dans-typesetting.delete-detached-without-asking")`);
  const copyPoints = await client.evaluate(`(() => {
    const grip = document.querySelector("[data-block-id='sample-introduction'] .document-block__grip").getBoundingClientRect();
    const page = document.querySelector(".document-page").getBoundingClientRect();
    return {
      start: { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 },
      end: { x: page.x + page.width / 2, y: page.bottom - 45 },
    };
  })()`);
  await pointerDrag(client, copyPoints.start, copyPoints.end, 1);
  assert(
    (await client.evaluate(`document.querySelectorAll("[data-block-id]").length`)) ===
      initialBlockCount + 1,
    "Alt-drag did not copy the block",
  );
  assert(
    await client.evaluate(`document.querySelector("[data-block-id='sample-introduction']") !== null`),
    "Alt-drag removed the original block",
  );

  await reloadBuilder(client);
  const detachPoints = await client.evaluate(`(() => {
    const grip = document.querySelector("[data-block-id='sample-introduction'] .document-block__grip").getBoundingClientRect();
    const page = document.querySelector(".document-page").getBoundingClientRect();
    return {
      start: { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 },
      end: { x: Math.max(12, page.x - 90), y: page.y + 120 },
    };
  })()`);
  await pointerDrag(client, detachPoints.start, detachPoints.end);
  assert(
    await client.evaluate(`document.querySelector("[role='alertdialog']") !== null`),
    "Dropping outside did not ask before deletion",
  );
  assert(
    (await client.evaluate(`document.querySelectorAll("[data-block-id]").length`)) ===
      initialBlockCount - 1,
    "The detached block jumped back while confirmation was open",
  );
  await client.evaluate(`[
    ...document.querySelector("[role='alertdialog']").querySelectorAll("button")
  ].find((button) => button.textContent.trim() === "Cancel").click()`);
  assert(
    (await client.evaluate(`document.querySelectorAll("[data-block-id]").length`)) ===
      initialBlockCount,
    "Cancel did not restore the detached block",
  );

  await reloadBuilder(client);
  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-figure']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(100);
  await client.evaluate(`(() => {
    const slider = document.querySelector(".image-editor input[type='range']");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(slider, "45");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await delay(50);
  assert(
    await client.evaluate(`document.querySelector(".image-editor-preview img").style.width === "45%"`),
    "Preferred image width did not update its preview immediately",
  );
  const documentRoot = await client.send("DOM.getDocument", { depth: -1, pierce: true });
  const fileInput = await client.send("DOM.querySelector", {
    nodeId: documentRoot.root.nodeId,
    selector: `input[data-testid="image-file-input"]`,
  });
  assert(fileInput.nodeId !== 0, "Image editor file input was not created");
  await client.send("DOM.setFileInputFiles", {
    nodeId: fileInput.nodeId,
    files: [sampleImagePath],
  });
  await delay(450);
  await client.evaluate(`[
    ...document.querySelector("[data-testid='block-editor-dialog']").querySelectorAll("button")
  ].find((button) => button.textContent.includes("Save image")).click()`);
  assert(
    await client.evaluate(`document.querySelector("[data-visual-block-id='sample-figure'] img").src.startsWith("data:image/svg+xml")`),
    "Selected image data was not committed to the preview",
  );

  await reloadBuilder(client);
  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-code-listing']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(80);
  await client.evaluate(`(() => {
    const source = document.querySelector("textarea[data-testid='code-listing-source']");
    const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    textareaSetter.call(source, "function answer()\\n    return 42\\nend");
    source.dispatchEvent(new Event("input", { bubbles: true }));
    source.setSelectionRange(8, 9);
    source.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab",
      code: "Tab",
      bubbles: true,
      cancelable: true,
    }));
    const language = document.querySelector(".code-listing-editor select");
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    selectSetter.call(language, "julia");
    language.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await delay(60);
  assert(
    await client.evaluate(`document.querySelector("textarea[data-testid='code-listing-source']").value.startsWith("function    answer")`),
    "Tab in the code-listing source editor did not insert four spaces",
  );
  assert(
    await client.evaluate(`(() => {
      const surface = document.querySelector(".code-editor-surface");
      return surface.querySelector("pre").textContent.startsWith("function    answer") &&
        surface.querySelector(".syntax-token--keyword")?.textContent === "function";
    })()`),
    "The directly editable listing did not update its syntax-coloured surface",
  );
  await screenshot(client, "code-listing-editor.png");
  await client.evaluate(`[
    ...document.querySelector("[data-testid='block-editor-dialog']").querySelectorAll("button")
  ].find((button) => button.textContent.includes("Save listing")).click()`);
  assert(
    await client.evaluate(`(() => {
      const listing = document.querySelector("[data-visual-block-id='sample-code-listing']");
      return listing.textContent.includes("function    answer()") && listing.textContent.includes("Julia");
    })()`),
    "The graphical code-listing editor did not commit C++/Julia semantic data",
  );

  await reloadBuilder(client);
  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-display-math']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(100);
  assert(
    await client.evaluate(`document.querySelector(".math-editor-canvas .math-summation-symbol") !== null`),
    "The math editor did not render the structured summation",
  );
  const heldNode = await client.evaluate(`(() => {
    const node = document.querySelector(".math-editor-canvas [data-math-path='left.left']");
    const bounds = node.getBoundingClientRect();
    return {
      point: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    };
  })()`);
  await pointerClick(client, heldNode.point);
  assert(
    await client.evaluate(`(() => {
      const canvas = document.querySelector(".math-editor-canvas");
      const node = canvas.querySelector("[data-math-path='left.left']");
      return node !== null && !node.classList.contains("math-node--slot") && document.querySelectorAll("[data-math-parking-id]").length === 0;
    })()`),
    "Clicking or holding a math node without moving detached it",
  );
  const mathPoints = await client.evaluate(`(() => {
    const center = (element) => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    };
    const canvas = document.querySelector(".math-editor-canvas");
    return {
      start: center(document.querySelector("[data-math-palette='integer-9']")),
      end: center(canvas.querySelector("[data-math-path='left.left.left']")),
    };
  })()`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: mathPoints.start.x,
    y: mathPoints.start.y,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: mathPoints.start.x,
    y: mathPoints.start.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await delay(70);
  assert(
    await client.evaluate(`document.querySelector(".math-drag-ghost") !== null`),
    "Math palette pointer-down did not begin a drag",
  );
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: mathPoints.end.x,
    y: mathPoints.end.y,
    button: "left",
    buttons: 1,
  });
  await delay(100);
  const highlightedMathPath = await client.evaluate(
    `document.querySelector(".math-editor-canvas .math-node--selected")?.dataset.mathPath ?? null`,
  );
  assert(
    highlightedMathPath === "left.left.left",
    `Nested math drop target was not highlighted (received ${String(highlightedMathPath)})`,
  );
  await screenshot(client, "math-editor-drag.png");
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: mathPoints.end.x,
    y: mathPoints.end.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await delay(80);
  assert(
    await client.evaluate(`document.querySelector(".math-editor-canvas").textContent.includes("9")`),
    "Math palette drop did not replace the nested integer",
  );

  const selectionPoints = await client.evaluate(`(() => {
    const canvas = document.querySelector(".math-editor-canvas").getBoundingClientRect();
    const root = document.querySelector(".math-editor-canvas [data-math-path='root']").getBoundingClientRect();
    const right = document.querySelector(".math-editor-canvas [data-math-path='right']").getBoundingClientRect();
    return {
      outside: { x: canvas.x + 12, y: canvas.y + 12 },
      equation: { x: root.x + root.width / 2, y: root.y + root.height / 2 },
      siblingInsideRoot: { x: right.x + right.width / 2, y: right.y + right.height / 2 },
    };
  })()`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: selectionPoints.outside.x,
    y: selectionPoints.outside.y,
  });
  await delay(50);
  assert(
    (await client.evaluate(`document.querySelectorAll("[data-math-selection-kind]").length`)) === 0,
    "Math selection overlays appeared while the pointer was outside the expression",
  );
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: selectionPoints.equation.x,
    y: selectionPoints.equation.y,
  });
  await delay(60);
  assert(
    (await client.evaluate(`document.querySelectorAll("[data-math-selection-kind]").length`)) === 4,
    "A binary math scope did not expose whole/left/operator/right selections",
  );
  await pressKey(client, "2", "Digit2");
  assert(
    (await client.evaluate(`document.querySelectorAll(".math-node--selection-locked").length`)) === 1,
    "Digit selection did not lock a nested math scope",
  );
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: selectionPoints.siblingInsideRoot.x,
    y: selectionPoints.siblingInsideRoot.y,
  });
  await delay(50);
  assert(
    (await client.evaluate(`document.querySelectorAll(".math-node--selection-locked").length`)) === 1,
    "A math lock was released inside the containing scope instead of at its boundary",
  );
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: selectionPoints.outside.x,
    y: selectionPoints.outside.y,
  });
  await delay(50);
  assert(
    (await client.evaluate(`document.querySelectorAll(".math-node--selection-locked").length`)) === 0,
    "Leaving the containing math scope did not release its selection lock",
  );
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: selectionPoints.equation.x,
    y: selectionPoints.equation.y,
  });
  await delay(50);
  await pressKey(client, "2", "Digit2");
  await pressKey(client, " ", "Space");
  assert(
    (await client.evaluate(`document.querySelectorAll(".math-node--selection-locked").length`)) === 0,
    "Space did not release the math selection lock",
  );

  const rightSelectionPoint = await client.evaluate(`(() => {
    const node = document.querySelector("[data-math-selection-kind='node'][data-math-selection-path='right']");
    const bounds = node.getBoundingClientRect();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  })()`);
  await pointerClick(client, rightSelectionPoint, "right");
  assert(
    await client.evaluate(`document.querySelector("[data-testid='math-radial-menu']") !== null`),
    "Right-clicking a math selection did not open the radial menu",
  );
  await client.evaluate(`[
    ...document.querySelector("[data-testid='math-radial-menu']").querySelectorAll("button")
  ].find((button) => button.textContent.trim() === "Parentheses").click()`);
  assert(
    await client.evaluate(`document.querySelector(".math-editor-canvas [data-math-path='right'].math-node--parenthesized") !== null`),
    "The radial menu did not wrap the selected subtree in parentheses",
  );

  const deleteByDetachingPoints = await client.evaluate(`(() => {
    const node = document.querySelector(".math-editor-canvas [data-math-path='left.right']").getBoundingClientRect();
    const canvas = document.querySelector(".math-editor-canvas").getBoundingClientRect();
    return {
      start: { x: node.x + node.width / 2, y: node.y + node.height / 2 },
      end: { x: canvas.x + 18, y: canvas.y + 18 },
    };
  })()`);
  await pointerDrag(client, deleteByDetachingPoints.start, deleteByDetachingPoints.end);
  assert(
    await client.evaluate(`document.querySelector(".math-editor-canvas [data-math-path='left.right'] .math-slot-action") !== null`),
    "Dropping a detached math fragment nowhere did not leave an empty slot",
  );
  await client.evaluate(`document.querySelector(".math-editor-canvas [data-math-path='left.right'] .math-slot-action").click()`);
  await delay(40);
  await client.evaluate(`(() => {
    const input = document.querySelector("input[data-math-slot-input='left.right']");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "-56.321/(a+[B,{c,-3}])");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  })()`);
  assert(
    await client.evaluate(`(() => {
      const replacement = document.querySelector(".math-editor-canvas [data-math-path='left.right']");
      return replacement.textContent.includes("56.321") &&
        replacement.querySelector(".math-node--negated") !== null &&
        replacement.querySelector(".math-node--delimited") !== null &&
        replacement.querySelector(".math-node--comma_sequence") !== null;
    })()`),
    "The registered basic-expression parser did not replace a math slot with structured input",
  );

  const parkPoints = await client.evaluate(`(() => {
    const node = document.querySelector(".math-editor-canvas [data-math-path='left.left']").getBoundingClientRect();
    const parking = document.querySelector(".math-parking").getBoundingClientRect();
    return {
      start: { x: node.x + node.width / 2, y: node.y + node.height / 2 },
      end: { x: parking.x + parking.width / 2, y: parking.y + parking.height / 2 },
    };
  })()`);
  await pointerDrag(client, parkPoints.start, parkPoints.end);
  assert(
    await client.evaluate(`document.querySelectorAll("[data-math-parking-id]").length === 1 && document.querySelector(".math-editor-canvas [data-math-path='left.left'] .math-slot-action") !== null`),
    "Detached math did not move into temporary parking",
  );
  const restoreParkedPoints = await client.evaluate(`(() => {
    const grip = document.querySelector(".math-parking__grip").getBoundingClientRect();
    const slot = document.querySelector(".math-editor-canvas [data-math-path='left.left']").getBoundingClientRect();
    return {
      start: { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 },
      end: { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 },
    };
  })()`);
  await pointerDrag(client, restoreParkedPoints.start, restoreParkedPoints.end);
  assert(
    await client.evaluate(`document.querySelectorAll("[data-math-parking-id]").length === 0 && document.querySelector(".math-editor-canvas [data-math-path='left.left'] .math-slot-action") === null`),
    "A parked math fragment could not be dragged back into the equation",
  );
  await screenshot(client, "math-editor-selection-and-parking.png");

  await reloadBuilder(client);
  const persistenceRoot = await client.send("DOM.getDocument", { depth: -1, pierce: true });
  const documentFileInput = await client.send("DOM.querySelector", {
    nodeId: persistenceRoot.root.nodeId,
    selector: `input[data-testid="load-document"]`,
  });
  assert(documentFileInput.nodeId !== 0, "Canonical document file input was not created");
  await client.send("DOM.setFileInputFiles", {
    nodeId: documentFileInput.nodeId,
    files: [canonicalFixturePath],
  });
  await delay(250);
  assert(
    await client.evaluate(`(() => {
      const blocks = [...document.querySelectorAll("[data-block-id]")];
      return blocks.length >= 9 &&
        document.body.textContent.includes("Canonical document") &&
        document.body.textContent.includes("A styled canonical paragraph") &&
        document.body.textContent.includes("third.party.block") &&
        document.querySelector("button[data-testid='save-document']") !== null;
    })()`),
    "Canonical document loading did not transactionally replace the graphical document",
  );
  await screenshot(client, "canonical-document-loaded.png");

  assert(client.exceptions.length === 0, `Browser exceptions: ${client.exceptions.join("; ")}`);
}

async function stopProcess(child) {
  if (child === null || child.exitCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(1_500).then(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }),
  ]);
}

const webPort = await reservePort();
const debugPort = await reservePort();
const profileDirectory = await mkdtemp(join(tmpdir(), "dans-typesetting-smoke-"));
const viteProcess = spawn(
  process.execPath,
  [join(builderDirectory, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(webPort), "--strictPort"],
  { cwd: builderDirectory, stdio: ["ignore", "pipe", "pipe"] },
);
let chromeProcess = null;
let client = null;

try {
  await waitForHttp(`http://127.0.0.1:${String(webPort)}/`);
  const chrome = await installedChrome();
  chromeProcess = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--no-default-browser-check",
      "--no-first-run",
      `--remote-debugging-port=${String(debugPort)}`,
      `--user-data-dir=${profileDirectory}`,
      "--window-size=1600,1000",
      `http://127.0.0.1:${String(webPort)}/`,
    ],
    { stdio: "ignore" },
  );
  const pages = await waitForJson(`http://127.0.0.1:${String(debugPort)}/json/list`);
  const page = pages.find((candidate) => candidate.type === "page");
  assert(page !== undefined, "Chrome did not expose a page target");
  const socket = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  client = new CdpClient(socket);
  await mkdir(resultsDirectory, { recursive: true });
  await exerciseBuilder(client);
  process.stdout.write(`Browser smoke test passed; screenshots are in ${resultsDirectory}\n`);
} finally {
  client?.close();
  await stopProcess(chromeProcess);
  await stopProcess(viteProcess);
  await rm(profileDirectory, { recursive: true, force: true });
}
