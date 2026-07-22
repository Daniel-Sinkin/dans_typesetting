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
const initialBlockCount = 11;
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
  "Item list",
  "Table",
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
      listItems: document.querySelectorAll("[data-visual-block-id='sample-item-list'] li").length,
      tableCells: document.querySelectorAll("[data-visual-block-id='sample-table'] [data-table-cell-id]").length,
      layers: [".document-visual-layer", ".excalidraw", ".document-control-layer"].map((selector) => getComputedStyle(document.querySelector(selector)).zIndex),
    };
  })()`);
  assert(initial.blocks === initialBlockCount, "The focused starter document did not contain eleven blocks");
  assert(
    JSON.stringify(initial.paletteLabels) === JSON.stringify(expectedPaletteLabels),
    "The active palette did not contain exactly the focused eleven block types",
  );
  assert(!initial.pythonPlotVisible, "Python Plot remained in the active builder UI");
  assert(initial.nestedExamples === 0, "The starter document still contains nested example blocks");
  assert(initial.grips === 0 && !initial.editButtons, "Legacy grip or Edit controls remained visible");
  assert(initial.imageLoaded && !initial.imageNumbered, "The bare image did not render as unnumbered content");
  assert(initial.drawing && initial.displayMath && initial.listing, "A focused visual block failed to render");
  assert(initial.listingLabel.includes("Listing 1"), "The Code Listing lost its writer-owned ordinal");
  assert(initial.listItems === 2 && initial.tableCells === 4, "List or table sample data was lost");
  assert(JSON.stringify(initial.layers) === JSON.stringify(["1", "2", "3"]), "Canvas layering is incorrect");

  await pointerSelect(client, "sample-paragraph");
  assert(
    await client.evaluate(`document.querySelector("[data-block-id='sample-paragraph']").classList.contains("document-block-controls--selected")`),
    "Single-click selection did not select the paragraph block",
  );
  await pointerSelect(client, "sample-display-math", { ctrlKey: true });
  assert(
    (await client.evaluate(`document.querySelectorAll(".document-block-controls--selected").length`)) === 2,
    "Same-level modifier multiselect did not retain both blocks",
  );

  await pointerSelect(client, "sample-section");
  await pointerSelect(client, "sample-paragraph");
  await pointerSelect(client, "sample-image", { ctrlKey: true });
  const dragPoints = await client.evaluate(`(() => {
    const start = document.querySelector("[data-block-id='sample-paragraph']").getBoundingClientRect();
    const target = document.querySelector("[data-block-id='sample-table']").getBoundingClientRect();
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

  await client.evaluate(`document.querySelector("[data-block-id='sample-paragraph']").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }))`);
  await waitForCondition(client, `document.querySelector("[data-testid='block-editor-dialog'] .paragraph-editor") !== null`);
  const writer = await client.evaluate(`(() => ({
    modes: [...document.querySelectorAll(".paragraph-editor__modes button")].map((button) => button.textContent.trim()),
    mathPreview: document.querySelector(".paragraph-composer__atom-preview .katex") !== null,
    linkPreview: document.querySelector(".paragraph-composer__atom-preview .inline-hyperlink")?.textContent === "formatted hyperlink",
    codePreview: document.querySelector(".paragraph-composer__atom-preview .inline-code-content")?.textContent === "cudaDeviceSynchronize()",
    grayDescriptions: document.querySelectorAll(".paragraph-composer__atom small").length,
    compactToolbar: parseFloat(getComputedStyle(document.querySelector(".paragraph-toolbar button")).height) <= 22,
  }))()`);
  assert(JSON.stringify(writer.modes) === JSON.stringify(["Write", "Source", "Preview"]), "The paragraph editor did not expose three editing modes");
  assert(writer.mathPreview && writer.linkPreview && writer.codePreview, "Semantic inlines were not previewed inside the writing surface");
  assert(writer.grayDescriptions === 0 && writer.compactToolbar, "Inline controls remained oversized or retained gray descriptions");

  await client.evaluate(`[...document.querySelectorAll(".paragraph-editor__modes button")].find((button) => button.textContent.trim() === "Source").click()`);
  await waitForCondition(client, `document.querySelector("[data-testid='paragraph-source']") !== null`);
  const sourceBefore = await client.evaluate(`document.querySelector("[data-testid='paragraph-source']").value`);
  assert(sourceBefore.includes("$x \\leftarrow x^{2n + 1}$"), "Source mode did not expose inline LaTeX");
  assert(sourceBefore.includes("[**formatted hyperlink**](https://en.wikipedia.org/)"), "Formatted hyperlink source was lost");
  await client.evaluate(`(() => {
    const textarea = document.querySelector("[data-testid='paragraph-source']");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, textarea.value + " Added $y^2$ §reference§sec:interactive-blocks§");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await client.evaluate(`[...document.querySelectorAll(".paragraph-editor__modes button")].find((button) => button.textContent.trim() === "Write").click()`);
  await waitForCondition(client, `document.querySelectorAll(".paragraph-composer__atom-preview .katex").length >= 2`);
  await screenshot(client, "paragraph-writer.png");
  await client.evaluate(`document.querySelector(".paragraph-editor button.primary-action").click()`);
  await waitForCondition(client, `document.querySelector("[data-testid='block-editor-dialog']") === null`);
  assert(
    await client.evaluate(`document.querySelector("[data-visual-block-id='sample-paragraph']").textContent.includes("Added")`),
    "Source-mode paragraph edits did not commit to the document preview",
  );

  await client.evaluate(`document.querySelector("[data-block-id='sample-excalidraw-drawing']").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }))`);
  await waitForCondition(client, `document.querySelector("[data-testid='excalidraw-drawing-editor']") !== null`);
  assert(
    await client.evaluate(`document.querySelector("[data-testid='drawing-width']") !== null && document.querySelector("[data-testid='excalidraw-drawing-editor'] input[name='canvasHeight']") === null`),
    "The Excalidraw popup did not keep percentage width with automatic height",
  );
  await client.evaluate(`document.querySelector("[data-testid='excalidraw-drawing-editor'] button").click()`);

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
