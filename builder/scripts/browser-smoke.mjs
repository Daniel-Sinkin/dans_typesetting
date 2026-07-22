// Exercise the focused builder workflow in an installed headless Chrome.
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
const initialBlockCount = 9;
const expectedPaletteLabels = [
  "Title page",
  "Table of contents",
  "Page break",
  "Section",
  "Paragraph",
  "Image",
  "Excalidraw drawing",
  "Display math",
  "Code listing",
];

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
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (result.exceptionDetails !== undefined) {
      throw new Error(`Browser evaluation failed: ${result.exceptionDetails.text}`);
    }
    return result.result.value;
  }

  close() {
    this.#socket.close();
  }
}

async function waitForCondition(client, expression, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await client.evaluate(expression)) {
        return;
      }
    } catch {
      // React or Vite may be replacing the current JavaScript context.
    }
    await delay(80);
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`);
}

async function waitForBuilder(client) {
  await waitForCondition(
    client,
    `document.querySelectorAll("[data-block-id]").length === ${String(initialBlockCount)} && document.querySelector(".document-page") !== null`,
  );
  await delay(500);
}

async function screenshot(client, filename) {
  const capture = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(join(resultsDirectory, filename), Buffer.from(capture.data, "base64"));
}

async function pointerSelect(client, blockId, modifiers = {}) {
  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='${blockId}']");
    block.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerId: 17,
      ctrlKey: ${String(modifiers.ctrlKey === true)},
      shiftKey: ${String(modifiers.shiftKey === true)},
    }));
  })()`);
  await delay(60);
  await client.evaluate(`window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 17 }))`);
  await delay(60);
}

async function keyOnBlock(client, blockId, key, modifiers = {}) {
  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='${blockId}']");
    block.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: ${JSON.stringify(key)},
      ctrlKey: ${String(modifiers.ctrlKey === true)},
      metaKey: ${String(modifiers.metaKey === true)},
      shiftKey: ${String(modifiers.shiftKey === true)},
    }));
  })()`);
  await delay(100);
}

async function sendNvimCommand(client, command) {
  await client.evaluate(`document.querySelector(".xterm-helper-textarea").focus()`);
  await client.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await client.send("Input.insertText", { text: command });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
}

async function pointerDrag(client, start, end) {
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: start.x,
    y: start.y,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: start.x,
    y: start.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await delay(60);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: start.x + 12,
    y: start.y + 12,
    button: "left",
    buttons: 1,
  });
  await delay(80);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: end.x,
    y: end.y,
    button: "left",
    buttons: 1,
  });
  await delay(100);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: end.x,
    y: end.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await delay(180);
}

async function exerciseBuilder(client) {
  await client.send("Runtime.enable");
  await client.send("DOM.enable");
  await client.send("Page.enable");
  await waitForBuilder(client);

  const initial = await client.evaluate(`(() => {
    const paletteLabels = [...document.querySelectorAll(".palette-card strong")].map((node) => node.textContent.trim());
    const image = document.querySelector("[data-visual-block-id='sample-image'] img");
    const mathBlock = document.querySelector("[data-visual-block-id='sample-display-math']");
    const mathBox = mathBlock.querySelector(".latex-math-display").getBoundingClientRect();
    const mathContent = mathBlock.querySelector(".katex-display").getBoundingClientRect();
    const mathRender = mathBlock.querySelector(".latex-math-render--display");
    const mathRenderBox = mathRender.getBoundingClientRect();
    const mathScrollerBox = mathBlock.querySelector(".latex-math-display__scroller").getBoundingClientRect();
    const mathDescendants = [...mathRender.querySelectorAll("*")]
      .map((node) => ({
        className: typeof node.className === "string" ? node.className : "",
        text: node.textContent.trim().slice(0, 20),
        ...(() => {
          const bounds = node.getBoundingClientRect();
          return { top: bounds.top, bottom: bounds.bottom };
        })(),
      }))
      .filter(({ top, bottom }) => bottom > top)
      .sort((left, right) => left.top - right.top);
    return {
      blocks: document.querySelectorAll("[data-block-id]").length,
      paletteLabels,
      pythonPlotVisible: document.body.textContent.includes("Python plot"),
      nestedExamples: document.querySelectorAll("[data-section-depth]:not([data-section-depth='0'])").length,
      grips: document.querySelectorAll(".document-block__grip").length,
      editButtons: [...document.querySelectorAll("[data-block-id] button")].some((button) => button.textContent.trim() === "Edit"),
      imageLoaded: image instanceof HTMLImageElement && image.complete && image.naturalWidth === 1280,
      imageNumbered: document.querySelector("[data-visual-block-id='sample-image'] figcaption") !== null,
      drawing: document.querySelector("[data-visual-block-id='sample-excalidraw-drawing'] img") !== null,
      displayMath: document.querySelector("[data-visual-block-id='sample-display-math'] .katex") !== null,
      listing: document.querySelector("[data-visual-block-id='sample-code-listing'] code")?.textContent.includes("std::println") ?? false,
      listingLabel: document.querySelector("[data-visual-block-id='sample-code-listing'] .code-listing-content__language")?.textContent ?? "",
      layers: [".document-page-layer", ".excalidraw", ".document-block-visual-layer", ".document-control-layer"].map((selector) => getComputedStyle(document.querySelector(selector)).zIndex),
      displayMathContained: mathContent.top >= mathBox.top - 0.5 && mathContent.bottom <= mathBox.bottom + 0.5,
      displayMathOverflow: getComputedStyle(mathRender).overflowY,
      displayMathTopClearance: Math.min(...mathDescendants.filter(({ text }) => text.length > 0).map(({ top }) => top)) - mathScrollerBox.top,
      displayMathMetrics: {
        boxTop: mathBox.top,
        boxBottom: mathBox.bottom,
        contentTop: mathContent.top,
        contentBottom: mathContent.bottom,
        renderTop: mathRenderBox.top,
        renderBottom: mathRenderBox.bottom,
        scrollerTop: mathScrollerBox.top,
        scrollerBottom: mathScrollerBox.bottom,
        highest: mathDescendants.slice(0, 8),
      },
    };
  })()`);
  assert(initial.blocks === initialBlockCount, "The focused starter document did not contain nine blocks");
  assert(
    JSON.stringify(initial.paletteLabels) === JSON.stringify(expectedPaletteLabels),
    "The active palette did not contain exactly the focused nine block types",
  );
  assert(!initial.pythonPlotVisible, "Python Plot remained in the active builder UI");
  assert(initial.nestedExamples === 0, "The starter document still contains nested example blocks");
  assert(initial.grips === 0 && !initial.editButtons, "Legacy grip or Edit controls remained visible");
  assert(initial.imageLoaded && !initial.imageNumbered, "The bare image did not render as unnumbered content");
  assert(initial.drawing && initial.displayMath && initial.listing, "A focused visual block failed to render");
  assert(initial.listingLabel.includes("Listing 1"), "The Code Listing lost its writer-owned ordinal");
  assert(JSON.stringify(initial.layers) === JSON.stringify(["1", "2", "3", "4"]), "Canvas layering is incorrect");
  assert(
    initial.displayMathContained &&
      initial.displayMathOverflow === "visible" &&
      initial.displayMathTopClearance >= 2,
    `The aligned display-math superscript can still be clipped: ${JSON.stringify(initial.displayMathMetrics)}, overflow=${initial.displayMathOverflow}`,
  );

  await pointerSelect(client, "sample-paragraph");
  await waitForCondition(
    client,
    `document.querySelector("[data-testid='nvim-block-editor'][data-visible='false']")?.textContent.includes("normal config loaded")`,
    20_000,
  );
  assert(
    await client.evaluate(`document.querySelector("[data-block-id='sample-paragraph']").classList.contains("document-block-controls--selected")`),
    "Single-click selection did not select the paragraph block",
  );
  assert(
    await client.evaluate(`document.querySelector("[data-block-id='sample-paragraph'] .document-block__selection-label")?.firstElementChild?.matches("button") ?? false`),
    "The stable delete control was not placed to the left of the block label",
  );
  await client.evaluate(`document.querySelector("[data-testid='nvim-block-editor']").dataset.hotSession = "startup-hot"`);
  await keyOnBlock(client, "sample-paragraph", "ArrowDown");
  assert(
    await client.evaluate(`document.querySelector("[data-block-id='sample-image']").classList.contains("document-block-controls--selected") && document.activeElement?.dataset.blockId === "sample-image" && document.querySelector("[data-testid='nvim-block-editor'][data-visible='false']")?.dataset.hotSession === "startup-hot"`),
    "ArrowDown did not move block selection while retaining the warm paragraph session",
  );
  await keyOnBlock(client, "sample-image", "ArrowUp");
  await waitForCondition(
    client,
    `document.querySelector("[data-testid='nvim-block-editor'][data-visible='false']")?.dataset.hotSession === "startup-hot"`,
    20_000,
  );
  await client.evaluate(`document.querySelector("[data-testid='nvim-block-editor']").dataset.hotSession = "paragraph-ready"`);
  await keyOnBlock(client, "sample-paragraph", "Enter");
  await waitForCondition(client, `document.querySelector(".nvim-editor-host--inline [data-testid='nvim-block-editor'][data-visible='true']") !== null`);
  const inlineNvim = await client.evaluate(`(() => ({
    dialog: document.querySelector("[data-testid='block-editor-dialog']") !== null,
    retainedSession: document.querySelector("[data-testid='nvim-block-editor']")?.dataset.hotSession === "paragraph-ready",
    hostWidth: document.querySelector(".nvim-editor-host--inline").getBoundingClientRect().width,
    blockWidth: document.querySelector("[data-block-id='sample-paragraph']").getBoundingClientRect().width,
  }))()`);
  assert(
    !inlineNvim.dialog && inlineNvim.retainedSession && inlineNvim.hostWidth >= inlineNvim.blockWidth * 0.8,
    "Enter did not reveal the already-hot Neovim session as an anchored paragraph box",
  );
  await screenshot(client, "paragraph-nvim.png");
  await sendNvimCommand(client, `:call append(line("$"), "Nvim paragraph edit.") | write`);
  await waitForCondition(
    client,
    `document.querySelector("[data-testid='nvim-block-editor']")?.textContent.includes(":write synchronized") && document.querySelector("[data-visual-block-id='sample-paragraph']").textContent.includes("Nvim paragraph edit")`,
    20_000,
  );
  assert(
    await client.evaluate(`document.querySelector("[data-testid='nvim-block-editor'][data-visible='true']") !== null`),
    ":w synchronized the paragraph but unexpectedly closed Neovim",
  );
  await sendNvimCommand(client, ":quit");
  await waitForCondition(client, `document.querySelector("[data-testid='nvim-block-editor']") === null && document.querySelector("[data-visual-block-id='sample-paragraph']").textContent.includes("Nvim paragraph edit")`, 20_000);

  await client.evaluate(`document.querySelector("[data-block-id='sample-paragraph']").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }))`);
  await waitForCondition(client, `document.querySelector(".nvim-editor-host--inline [data-testid='nvim-block-editor'][data-visible='true']") !== null`, 20_000);
  assert(
    await client.evaluate(`document.querySelector("[data-testid='block-editor-dialog']") === null`),
    "Double-click paragraph editing opened a separate dialog instead of its anchored Neovim box",
  );
  await client.evaluate(`document.querySelector("[data-testid='nvim-block-editor'] footer button").click()`);
  await waitForCondition(client, `document.querySelector("[data-testid='nvim-block-editor']") === null`);

  await pointerSelect(client, "sample-display-math", { ctrlKey: true });
  assert(
    (await client.evaluate(`document.querySelectorAll(".document-block-controls--selected").length`)) === 2,
    "Same-level modifier multiselect did not retain both blocks",
  );

  await pointerSelect(client, "sample-page-break");
  await keyOnBlock(client, "sample-page-break", "Delete");
  await waitForCondition(client, `document.querySelector("[data-block-id='sample-page-break']") === null && document.querySelector("[data-block-id='sample-section']").classList.contains("document-block-controls--selected")`);
  assert(
    await client.evaluate(`document.activeElement?.dataset.blockId === "sample-section"`),
    "Deleting a block did not select and focus the following block",
  );
  await keyOnBlock(client, "sample-section", "z", { ctrlKey: true });
  await waitForCondition(
    client,
    `document.querySelector("[data-block-id='sample-page-break']") !== null && document.querySelector("[data-block-id='sample-page-break']").classList.contains("document-block-controls--selected")`,
  );
  assert(
    await client.evaluate(`document.querySelector("[data-visual-block-id='sample-paragraph']").textContent.includes("Nvim paragraph edit")`),
    "Structural undo reverted a paragraph content edit",
  );

  await pointerSelect(client, "sample-section");
  const backgroundPoint = await client.evaluate(`(() => {
    for (let y = 120; y < innerHeight - 40; y += 32) {
      for (let x = 80; x < innerWidth - 80; x += 32) {
        if (document.elementFromPoint(x, y) instanceof HTMLCanvasElement) {
          return { x, y };
        }
      }
    }
    throw new Error("Could not find exposed Excalidraw background");
  })()`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: backgroundPoint.x,
    y: backgroundPoint.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: backgroundPoint.x,
    y: backgroundPoint.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await waitForCondition(client, `document.querySelectorAll(".document-block-controls--selected").length === 0`);

  const zoomGesture = await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-paragraph']");
    const bounds = block.getBoundingClientRect();
    const before = document.querySelector(".document-controls").style.transform;
    const wheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
      deltaY: -8,
      ctrlKey: true,
    });
    block.dispatchEvent(wheel);
    return { before, prevented: wheel.defaultPrevented };
  })()`);
  assert(zoomGesture.prevented, "Ctrl-wheel over a document block was not claimed by the canvas");
  await waitForCondition(client, `document.querySelector(".document-controls").style.transform !== ${JSON.stringify(zoomGesture.before)}`);

  const panGesture = await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-paragraph']");
    const bounds = block.getBoundingClientRect();
    const before = document.querySelector(".document-controls").style.transform;
    block.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      button: 1,
      buttons: 4,
      pointerId: 29,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      cancelable: true,
      buttons: 4,
      pointerId: 29,
      clientX: bounds.left + bounds.width / 2 + 42,
      clientY: bounds.top + bounds.height / 2 + 24,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      button: 1,
      pointerId: 29,
      clientX: bounds.left + bounds.width / 2 + 42,
      clientY: bounds.top + bounds.height / 2 + 24,
    }));
    return before;
  })()`);
  await waitForCondition(client, `document.querySelector(".document-controls").style.transform !== ${JSON.stringify(panGesture)}`);

  const orderBeforeGroupDrag = await client.evaluate(
    `[...document.querySelectorAll("[data-block-id]")].map((node) => node.dataset.blockId)`,
  );
  await pointerSelect(client, "sample-section");
  await pointerSelect(client, "sample-paragraph");
  await pointerSelect(client, "sample-image", { ctrlKey: true });
  const dragPoints = await client.evaluate(`(() => {
    const start = document.querySelector("[data-block-id='sample-paragraph']").getBoundingClientRect();
    const target = document.querySelector("[data-block-id='sample-code-listing']").getBoundingClientRect();
    return {
      start: { x: start.left + start.width / 2, y: start.top + start.height / 2 },
      end: { x: target.left + target.width / 2, y: target.bottom - 3 },
    };
  })()`);
  await pointerDrag(client, dragPoints.start, dragPoints.end);
  const orderAfterGroupDrag = await client.evaluate(
    `[...document.querySelectorAll("[data-block-id]")].map((node) => node.dataset.blockId)`,
  );
  const paragraphIndex = orderAfterGroupDrag.indexOf("sample-paragraph");
  assert(
    paragraphIndex >= 0 && orderAfterGroupDrag[paragraphIndex + 1] === "sample-image",
    "Contiguous multiselect dragging did not preserve block order",
  );
  await keyOnBlock(client, "sample-paragraph", "z", { ctrlKey: true });
  await waitForCondition(
    client,
    `JSON.stringify([...document.querySelectorAll("[data-block-id]")].map((node) => node.dataset.blockId)) === ${JSON.stringify(JSON.stringify(orderBeforeGroupDrag))}`,
  );

  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-paragraph']");
    const bounds = block.getBoundingClientRect();
    block.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    }));
  })()`);
  await waitForCondition(client, `document.querySelector("[data-testid='block-radial-menu']") !== null`);
  const radialLabels = await client.evaluate(`[...document.querySelectorAll("[data-testid='block-radial-menu'] [role='menuitem']")].map((button) => button.textContent.trim())`);
  assert(
      radialLabels.some((label) => label.includes("Edit")) &&
      radialLabels.some((label) => label.includes("Full editor")) &&
      radialLabels.some((label) => label.includes("Visual edit")) &&
      radialLabels.some((label) => label.includes("Duplicate")) &&
      radialLabels.some((label) => label.includes("Delete")),
    "The block context menu did not expose the expected radial actions",
  );
  await client.evaluate(`[...document.querySelectorAll("[data-testid='block-radial-menu'] [role='menuitem']")].find((button) => button.textContent.includes("Duplicate")).click()`);
  await waitForCondition(client, `document.querySelectorAll("[data-block-id]").length === ${String(initialBlockCount + 1)}`);
  const duplicateId = await client.evaluate(`document.querySelector(".document-block-controls--selected")?.dataset.blockId`);
  assert(typeof duplicateId === "string" && duplicateId !== "sample-paragraph", "Duplicating a block did not select the inserted copy");
  await keyOnBlock(client, duplicateId, "z", { ctrlKey: true });
  await waitForCondition(client, `document.querySelectorAll("[data-block-id]").length === ${String(initialBlockCount)} && document.querySelector("[data-block-id='${duplicateId}']") === null`);
  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-paragraph']");
    const bounds = block.getBoundingClientRect();
    block.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    }));
  })()`);
  await waitForCondition(client, `document.querySelector("[data-testid='block-radial-menu']") !== null`);
  await client.evaluate(`[...document.querySelectorAll("[data-testid='block-radial-menu'] [role='menuitem']")].find((button) => button.textContent.includes("Visual edit")).click()`);
  await waitForCondition(client, `document.querySelector("[data-testid='inline-paragraph-editor']") !== null`);
  const writer = await client.evaluate(`(() => ({
    modes: [...document.querySelectorAll(".inline-paragraph-editor__modes button")].map((button) => button.textContent.trim()),
    dialog: document.querySelector("[data-testid='block-editor-dialog']") !== null,
    mathPreview: document.querySelector(".inline-paragraph-editor .paragraph-composer__atom-preview .katex") !== null,
    linkPreview: document.querySelector(".inline-paragraph-editor .paragraph-composer__atom-preview .inline-hyperlink")?.textContent === "formatted hyperlink",
    codePreview: document.querySelector(".inline-paragraph-editor .paragraph-composer__atom-preview .inline-code-content")?.textContent === "cudaDeviceSynchronize()",
    grayDescriptions: document.querySelectorAll(".inline-paragraph-editor .paragraph-composer__atom small").length,
    compactToolbar: parseFloat(getComputedStyle(document.querySelector(".inline-paragraph-editor__footer button")).height) <= 24,
  }))()`);
  assert(JSON.stringify(writer.modes) === JSON.stringify(["Write", "Source"]) && !writer.dialog, "The inline visual paragraph editor did not expose its source choice");
  assert(writer.mathPreview && writer.linkPreview && writer.codePreview, "Semantic inlines were not previewed inside the writing surface");
  assert(writer.grayDescriptions === 0 && writer.compactToolbar, "Inline controls remained oversized or retained gray descriptions");

  await client.evaluate(`[...document.querySelectorAll(".inline-paragraph-editor__modes button")].find((button) => button.textContent.trim() === "Source").click()`);
  await waitForCondition(client, `document.querySelector("[data-testid='inline-paragraph-source']") !== null`);
  const sourceBefore = await client.evaluate(`document.querySelector("[data-testid='inline-paragraph-source']").value`);
  assert(sourceBefore.includes("$x \\leftarrow x^{2n + 1}$"), "Source mode did not expose inline LaTeX");
  assert(sourceBefore.includes("[**formatted hyperlink**](https://en.wikipedia.org/)"), "Formatted hyperlink source was lost");
  await client.evaluate(`(() => {
    const textarea = document.querySelector("[data-testid='inline-paragraph-source']");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, textarea.value + " Added $y^2$ §reference§sec:interactive-blocks§");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await client.evaluate(`[...document.querySelectorAll(".inline-paragraph-editor__modes button")].find((button) => button.textContent.trim() === "Write").click()`);
  await waitForCondition(client, `document.querySelectorAll(".inline-paragraph-editor .paragraph-composer__atom-preview .katex").length >= 2`);
  await screenshot(client, "paragraph-writer.png");
  await client.evaluate(`document.querySelector(".inline-paragraph-editor button.primary-action").click()`);
  await waitForCondition(client, `document.querySelector("[data-testid='inline-paragraph-editor']") === null`);
  assert(
    await client.evaluate(`document.querySelector("[data-visual-block-id='sample-paragraph']").textContent.includes("Added")`),
    "Source-mode paragraph edits did not commit to the document preview",
  );

  await pointerSelect(client, "sample-code-listing");
  await waitForCondition(
    client,
    `document.querySelector("[data-testid='nvim-block-editor'][data-visible='false']")?.textContent.includes("normal config loaded")`,
    20_000,
  );
  await client.evaluate(`document.querySelector("[data-testid='nvim-block-editor']").dataset.hotSession = "code-ready"`);
  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-code-listing']");
    const bounds = block.getBoundingClientRect();
    block.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    }));
  })()`);
  await waitForCondition(client, `document.querySelector("[data-testid='block-radial-menu']") !== null`);
  await client.evaluate(`[...document.querySelectorAll("[data-testid='block-radial-menu'] [role='menuitem']")].find((button) => button.textContent.includes("Neovim")).click()`);
  await waitForCondition(client, `document.querySelector(".nvim-editor-host--dialog [data-testid='nvim-block-editor'][data-visible='true']")?.dataset.hotSession === "code-ready"`);
  assert(
    await client.evaluate(`document.querySelector("[data-testid='block-editor-dialog']") === null`),
    "The preloaded code Neovim session was wrapped in a second editor dialog",
  );
  await delay(1_800);
  await screenshot(client, "nvim-editor.png");
  await sendNvimCommand(client, `:call append(line("$"), "// nvim browser bridge") | write`);
  await waitForCondition(
    client,
    `document.querySelector("[data-testid='nvim-block-editor']")?.textContent.includes(":write synchronized") && document.querySelector("[data-visual-block-id='sample-code-listing']").textContent.includes("nvim browser bridge")`,
    20_000,
  );
  assert(
    await client.evaluate(`document.querySelector("[data-testid='nvim-block-editor'][data-visible='true']") !== null`),
    ":w did not keep the code Neovim session open",
  );
  await sendNvimCommand(client, ":quit");
  await waitForCondition(client, `document.querySelector("[data-testid='nvim-block-editor']") === null && document.querySelector("[data-visual-block-id='sample-code-listing']").textContent.includes("nvim browser bridge")`, 20_000);

  await keyOnBlock(client, "sample-code-listing", "Enter");
  await waitForCondition(client, `document.querySelector("[data-testid='inline-code-listing-editor']") !== null`);
  await waitForCondition(
    client,
    `document.activeElement?.dataset.testid === "inline-code-listing-source" && document.querySelector("[data-testid='block-editor-dialog']") === null`,
  );
  await client.evaluate(`(() => {
    const textarea = document.querySelector("[data-testid='inline-code-listing-source']");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, textarea.value + "\\n\\n\\n\\n// keyboard-only edit\\n\\n\\n\\n");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await waitForCondition(client, `document.querySelector("[data-testid='inline-code-listing-source']").value.includes("keyboard-only edit")`);
  await client.evaluate(`document.querySelector("[data-testid='inline-code-listing-source']").dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", ctrlKey: true }))`);
  await waitForCondition(client, `document.querySelector("[data-testid='inline-code-listing-editor']") === null && document.querySelector("[data-visual-block-id='sample-code-listing']").textContent.includes("keyboard-only edit")`);
  assert(
    await client.evaluate(`!/(?:\\r?\\n){2,}$/.test(document.querySelector("[data-visual-block-id='sample-code-listing'] code").textContent)`),
    "The code preview retained artificial trailing blank lines",
  );

  await client.evaluate(`document.querySelector("[data-block-id='sample-display-math']").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }))`);
  await waitForCondition(client, `document.querySelector("[data-testid='inline-latex-math-editor']") !== null`);
  assert(
    await client.evaluate(`document.querySelector("[data-testid='block-editor-dialog']") === null && document.querySelector("[data-testid='inline-latex-math-source']").value.includes("x_{n+1}")`),
    "Display math did not open as inline LaTeX source",
  );
  await client.evaluate(`document.querySelector("[data-testid='inline-latex-math-editor'] footer button").click()`);
  await waitForCondition(client, `document.querySelector("[data-testid='inline-latex-math-editor']") === null`);

  await client.evaluate(`document.querySelector("[data-block-id='sample-image']").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }))`);
  await waitForCondition(client, `document.querySelector("[data-testid='block-editor-dialog'] .content-image-editor") !== null`);
  assert(
    await client.evaluate(`(() => {
      const input = document.querySelector("[data-testid='image-file-input']");
      return input.files.length === 0 && document.activeElement !== input;
    })()`),
    "Opening image settings immediately activated the replacement picker",
  );
  await client.evaluate(`document.querySelector(".editor-dialog__header [aria-label='Close editor']").click()`);
  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-image']");
    const bounds = block.getBoundingClientRect();
    block.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    }));
  })()`);
  await waitForCondition(client, `document.querySelector("[data-testid='block-radial-menu']") !== null`);
  assert(
    await client.evaluate(`[...document.querySelectorAll("[data-testid='block-radial-menu'] [role='menuitem']")].some((button) => button.textContent.includes("Replace image"))`),
    "The image context menu did not expose replacement as a separate command",
  );
  await client.evaluate(`document.querySelector(".block-radial-menu__center").click()`);

  await client.evaluate(`document.querySelector("[data-block-id='sample-excalidraw-drawing']").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }))`);
  await waitForCondition(client, `document.querySelector("[data-testid='excalidraw-drawing-editor']") !== null`);
  const drawingEditor = await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='excalidraw-drawing-editor']");
    const zoom = editor.querySelector(".zoom-actions");
    return {
      settings: editor.querySelector("[data-testid='drawing-width']") !== null,
      embeddedScene: editor.textContent.includes("Embedded scene"),
      actions: [...editor.querySelectorAll(".drawing-editor__actions button")].map((button) => button.textContent.trim()),
      zoomHidden: zoom === null || getComputedStyle(zoom).display === "none",
    };
  })()`);
  assert(
    !drawingEditor.settings && !drawingEditor.embeddedScene && drawingEditor.zoomHidden && JSON.stringify(drawingEditor.actions) === JSON.stringify(["Cancel", "Save drawing"]),
    "The drawing popup still mixed document settings or movable-camera controls into Excalidraw",
  );
  await client.evaluate(`document.querySelector(".drawing-editor__actions button").click()`);
  await waitForCondition(client, `document.querySelector("[data-testid='excalidraw-drawing-editor']") === null`);

  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-excalidraw-drawing']");
    const bounds = block.getBoundingClientRect();
    block.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    }));
  })()`);
  await waitForCondition(client, `document.querySelector("[data-testid='block-radial-menu']") !== null`);
  await client.evaluate(`[...document.querySelectorAll("[data-testid='block-radial-menu'] [role='menuitem']")].find((button) => button.textContent.includes("Drawing settings")).click()`);
  await waitForCondition(client, `document.querySelector("[data-testid='drawing-settings-editor']") !== null`);
  assert(
    await client.evaluate(`document.querySelector("[data-testid='drawing-width']").value === "90" && document.querySelector("[data-testid='drawing-height']").value === "540"`),
    "Drawing settings did not expose exact document width and fixed artboard height",
  );
  await client.evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const width = document.querySelector("[data-testid='drawing-width']");
    const height = document.querySelector("[data-testid='drawing-height']");
    setter.call(width, "100");
    width.dispatchEvent(new Event("input", { bubbles: true }));
    setter.call(height, "480");
    height.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await client.evaluate(`document.querySelector("[data-testid='drawing-settings-editor'] button.primary-action").click()`);
  await waitForCondition(client, `document.querySelector("[data-testid='drawing-settings-editor']") === null`);
  assert(
    await client.evaluate(`(() => {
      const scene = document.querySelector("[data-visual-block-id='sample-excalidraw-drawing'] .drawing-content__scene");
      return scene.style.width === "100%" && scene.style.aspectRatio.replaceAll(" ", "") === "960/480";
    })()`),
    "The drawing preview did not preserve the configured 100% fixed artboard",
  );

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
