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
  "current-features.dans_doc",
);
const sampleCsvPath = join(resultsDirectory, "sample-table.csv");
const sampleBibtexPath = join(resultsDirectory, "sample-bibliography.bib");
const initialBlockCount = 17;
const initialParagraphSegmentCount = 20;

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
    const padding = document.querySelector("[data-visual-block-id='sample-padding']")?.getBoundingClientRect();
    const paddedParagraph = document.querySelector("[data-visual-block-id='sample-padding-paragraph']")?.getBoundingClientRect();
    return {
      blocks: document.querySelectorAll("[data-block-id]").length,
      imageLoaded: image instanceof HTMLImageElement && image.complete && image.naturalWidth === 1280,
      latexMath: document.querySelector("[data-visual-block-id='sample-display-math'] .latex-math-display .katex") !== null,
      latexMathVocabulary: document.querySelector("[data-visual-block-id='sample-display-math'] .katex-html")?.textContent.includes("∑") === true && document.querySelector("[data-visual-block-id='sample-display-math'] .katex-html")?.textContent.includes("λ") === true,
      codeListing: document.querySelector("[data-visual-block-id='sample-code-listing'] code")?.textContent.includes("std::println") ?? false,
      opaqueFallback: document.body.textContent.includes("dans.future.block"),
      inlineMath: document.querySelector("[data-latex-math-inline-id='sample-introduction-inline-math'] .katex") !== null,
      inlineRelation: document.querySelector("[data-latex-math-inline-id='sample-introduction-inline-math'] .katex-html")?.textContent.includes("≈") ?? false,
      hyperlink: document.querySelector("a[href='https://example.com/typesetting']")?.textContent.includes("clickable links") ?? false,
      styledText: document.querySelector("[data-visual-block-id='sample-introduction'] strong em")?.textContent === "Styled text",
      inlineCode: document.querySelector("[data-visual-block-id='sample-introduction'] .inline-code-content")?.textContent === "cudaDeviceSynchronize()",
      citation: document.querySelector("[data-visual-block-id='sample-introduction'] .inline-citation")?.textContent === "[1, 2]",
      bibliographyEntries: document.querySelectorAll("[data-visual-block-id='sample-bibliography'] [data-bibliography-entry-key]").length,
      bibliographyDoi: document.querySelector("[data-visual-block-id='sample-bibliography'] a[href='https://doi.org/10.1080/14789940801912366']") !== null,
      figureNumber: document.querySelector("[data-visual-block-id='sample-figure'] figcaption")?.textContent.includes("Figure 1:") ?? false,
      figureCaptionMath: document.querySelector("[data-visual-block-id='sample-figure'] figcaption .latex-math-inline .katex") !== null,
      figureCaptionColor: document.querySelector("[data-visual-block-id='sample-figure'] figcaption .inline-color-span")?.textContent.includes("with colour") ?? false,
      figurePairPanels: document.querySelectorAll("[data-visual-block-id='sample-figure-pair'] [data-figure-panel-id]").length,
      figurePairNumber: document.querySelector("[data-visual-block-id='sample-figure-pair'] .figure-pair-content__caption")?.textContent.includes("Figure 2:") ?? false,
      figurePairMath: document.querySelectorAll("[data-visual-block-id='sample-figure-pair'] .latex-math-inline .katex").length,
      figurePairPanelTargets: document.getElementById("dans-reference-fig%3Apaired-models%3Aleft") !== null && document.getElementById("dans-reference-fig%3Apaired-models%3Aright") !== null,
      equationNumbers: [...document.querySelectorAll("[data-visual-block-id='sample-display-math'] .math-equation-number")].map((node) => node.textContent.trim()),
      listingNumber: document.querySelector("[data-visual-block-id='sample-code-listing'] figcaption")?.textContent.includes("Listing 1:") ?? false,
      listingCaptionCode: document.querySelector("[data-visual-block-id='sample-code-listing'] figcaption .inline-code-content")?.textContent === "std::println",
      drawingPreview: document.querySelector("[data-visual-block-id='sample-excalidraw-drawing'] img")?.src.startsWith("blob:") ?? false,
      drawingNumber: document.querySelector("[data-visual-block-id='sample-excalidraw-drawing'] figcaption")?.textContent.includes("Figure 3:") ?? false,
      itemListPresentation: document.querySelector("[data-visual-block-id='sample-item-list'] ol")?.dataset.listPresentation ?? null,
      itemListCount: document.querySelectorAll("[data-visual-block-id='sample-item-list'] li").length,
      itemListMath: document.querySelector("[data-visual-block-id='sample-item-list'] .latex-math-inline .katex") !== null,
      tableNumber: document.querySelector("[data-visual-block-id='sample-table'] figcaption")?.textContent.includes("Table 1:") ?? false,
      tableCellCount: document.querySelectorAll("[data-visual-block-id='sample-table'] [data-table-cell-id]").length,
      tableMath: document.querySelector("[data-visual-block-id='sample-table'] .latex-math-inline .katex") !== null,
      tableFootnote: document.querySelector("[data-visual-block-id='sample-table'] .footnote-preview > sup > button")?.textContent.trim() === "2",
      tableReference: [...document.querySelectorAll(".inline-reference")].some((reference) => reference.textContent === "Table 1"),
      paddingNested: padding !== undefined && paddedParagraph !== undefined && paddedParagraph.left > padding.left && paddedParagraph.right < padding.right && paddedParagraph.top > padding.top && paddedParagraph.bottom < padding.bottom,
      layers: layers.map((layer) => layer === null ? null : getComputedStyle(layer).zIndex),
    };
  })()`);
  assert(initial.blocks === initialBlockCount, "Expected all initial document blocks");
  assert(initial.imageLoaded, "The real sample image did not load");
  assert(initial.latexMath, "Text-authored display math was not rendered through KaTeX");
  assert(initial.latexMathVocabulary && initial.inlineRelation, "LaTeX math symbols or relations were not rendered");
  assert(initial.codeListing, "The C++ code-listing plugin was not rendered");
  assert(initial.opaqueFallback, "The opaque block fallback was not rendered");
  assert(initial.inlineMath, "Text-authored inline mathematics was not rendered");
  assert(initial.hyperlink, "The semantic hyperlink was not rendered as a clickable link");
  assert(initial.styledText, "Styled Core Text was not rendered");
  assert(initial.inlineCode, "Semantic inline code was not rendered");
  assert(initial.citation, "Semantic multi-citation numbering was not resolved");
  assert(initial.bibliographyEntries === 2, "The bibliography lost normalized entries");
  assert(initial.bibliographyDoi, "A bibliography DOI was not rendered as a working link");
  assert(
    initial.figureNumber &&
      initial.listingNumber &&
      JSON.stringify(initial.equationNumbers) === JSON.stringify(["(1)"]),
    "Live numbering did not include the text-authored display equation",
  );
  assert(
    initial.figureCaptionMath && initial.figureCaptionColor,
    "The ordinary figure did not render its rich caption",
  );
  assert(initial.listingCaptionCode, "The listing did not render its rich inline-code caption");
  assert(
    initial.figurePairPanels === 2 &&
      initial.figurePairNumber &&
      initial.figurePairMath >= 2 &&
      initial.figurePairPanelTargets,
    `The paired figure did not render rich, independently targetable panels: ${JSON.stringify({
      panels: initial.figurePairPanels,
      number: initial.figurePairNumber,
      math: initial.figurePairMath,
      targets: initial.figurePairPanelTargets,
    })}`,
  );
  assert(initial.drawingPreview, "The Excalidraw scene was not projected through SVG");
  assert(initial.drawingNumber, "The embedded drawing did not join figure numbering");
  assert(initial.itemListPresentation === "enumerated", "The semantic list presentation was not rendered");
  assert(initial.itemListCount === 3, "The semantic list lost an item");
  assert(initial.itemListMath, "List items did not consume the shared inline-math adapter");
  assert(initial.tableNumber, "The semantic table did not join live block numbering");
  assert(initial.tableCellCount === 9, "The semantic table lost rectangular cell data");
  assert(initial.tableMath, "Table cells did not consume the shared inline-math adapter");
  assert(initial.tableFootnote, "Table cells did not join inline occurrence numbering");
  assert(initial.tableReference, "The semantic table did not publish a live reference target");
  assert(initial.paddingNested, "Padding did not place its named child sequence inside its bounds");
  assert(JSON.stringify(initial.layers) === JSON.stringify(["1", "2", "3"]), "Canvas layering is incorrect");

  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-opaque-block']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(30);
  assert(
    client.consoleCalls.some((message) => message.includes("Trying to Edit")),
    "Unsupported editing did not report the stable handle",
  );

  await screenshot(client, "document-builder.png");

  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-figure-pair']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(100);
  assert(
    await client.evaluate(`(() => {
      const editor = document.querySelector(".figure-pair-editor");
      return editor !== null &&
        editor.querySelectorAll(".figure-pair-editor__panels > section").length === 2 &&
        editor.querySelectorAll(".inline-sequence-editor").length === 3;
    })()`),
    "The paired-figure editor did not expose two panels and three rich captions",
  );
  await client.evaluate(`(() => {
    const editor = document.querySelector(".figure-pair-editor");
    const slider = editor.querySelector("input[type='range']");
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    inputSetter.call(slider, "40");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    const groupReference = editor.querySelector(".figure-pair-editor__metadata input:not([type='range'])");
    inputSetter.call(groupReference, "");
    groupReference.dispatchEvent(new Event("input", { bubbles: true }));
    const textarea = editor.querySelector("textarea[data-inline-id='sample-pair-left-text']");
    const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    textareaSetter.call(textarea, "Edited panel ");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await delay(100);
  assert(
    await client.evaluate(`(() => {
      const editor = document.querySelector(".figure-pair-editor");
      const firstPanel = editor.querySelector(".figure-pair-content__panels > figure");
      return firstPanel?.style.width === "40%" &&
        firstPanel.textContent.includes("Edited panel") &&
        editor.querySelector(".figure-pair-content")?.id === "" &&
        editor.querySelector(".figure-pair-content__caption")?.textContent.includes("Figure 2:");
    })()`),
    "The paired-figure width and rich caption did not live-update",
  );
  await screenshot(client, "figure-pair-editor.png");
  await client.evaluate(`(() => {
    const editor = document.querySelector(".figure-pair-editor");
    [...editor.querySelectorAll("button")].find((button) => button.textContent.includes("Save figure pair")).click();
  })()`);
  await delay(120);
  assert(
    await client.evaluate(`(() => {
      const pair = document.querySelector("[data-visual-block-id='sample-figure-pair']");
      return pair.textContent.includes("Edited panel") &&
        pair.querySelector(".figure-pair-content__panels > figure")?.style.width === "40%" &&
        pair.querySelector(".figure-pair-content__caption")?.textContent.includes("Figure 2:") &&
        document.getElementById("dans-reference-fig%3Apaired-models") === null &&
        document.getElementById("dans-reference-fig%3Apaired-models%3Aleft") !== null;
    })()`),
    "The paired-figure editor did not commit its draft",
  );

  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-item-list']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(100);
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='item-list-editor']");
    const firstItem = editor.querySelector("[data-list-editor-item='sample-list-item-contract']");
    const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    const originalText = firstItem.querySelector("textarea");
    textareaSetter.call(originalText, "Edited list contract.");
    originalText.dispatchEvent(new Event("input", { bubbles: true }));
    firstItem.querySelector("button[data-list-add-inline='dans.core.text']").click();
  })()`);
  await delay(50);
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='item-list-editor']");
    const firstItem = editor.querySelector("[data-list-editor-item='sample-list-item-contract']");
    const textareas = firstItem.querySelectorAll("textarea");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textareas[1], "Leading segment. ");
    textareas[1].dispatchEvent(new Event("input", { bubbles: true }));
    firstItem.querySelector("button[aria-label='Move segment 2 left']").click();
    editor.querySelector("input[value='itemized']").click();
    editor.querySelector("button[aria-label='Move item 1 down']").click();
    editor.querySelector("button.item-list-editor__add-item").click();
  })()`);
  await delay(80);
  assert(
    await client.evaluate(`(() => {
      const editor = document.querySelector("[data-testid='item-list-editor']");
      return editor.querySelector("ul[data-list-presentation='itemized']") !== null &&
        editor.querySelectorAll("[data-list-editor-item]").length === 4;
    })()`),
    "The list editor did not preview presentation, segment, item-order, and item-count drafts",
  );
  await screenshot(client, "item-list-editor.png");
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='item-list-editor']");
    [...editor.querySelectorAll("button")].find((button) => button.textContent.includes("Save list")).click();
  })()`);
  await delay(120);
  assert(
    await client.evaluate(`(() => {
      const list = document.querySelector("[data-visual-block-id='sample-item-list']");
      const items = list.querySelectorAll("li");
      return list.querySelector("ul[data-list-presentation='itemized']") !== null &&
        items.length === 4 &&
        items[1].textContent.includes("Leading segment. Edited list contract.");
    })()`),
    "The semantic list editor did not commit its composed draft",
  );

  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-table']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(100);
  assert(
    await client.evaluate(`(() => {
      const editor = document.querySelector("[data-testid='table-editor']");
      return editor !== null &&
        editor.querySelector("[aria-label='CSV extension controls']") !== null &&
        editor.querySelector("figcaption")?.textContent.includes("Table 1:");
    })()`),
    "The rich-table editor or optional CSV capability was not composed",
  );
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='table-editor']");
    editor.querySelector("[data-table-editor-cell='sample-table-svd-runtime']").click();
  })()`);
  await delay(50);
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='table-editor']");
    const textarea = editor.querySelector("textarea[data-inline-id='sample-table-svd-runtime-text']");
    const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    textareaSetter.call(textarea, "9.75");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    const alignment = editor.querySelector("select[aria-label='Column 3 alignment']");
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    selectSetter.call(alignment, "center");
    alignment.dispatchEvent(new Event("change", { bubbles: true }));
    [...editor.querySelectorAll("button")].find((button) => button.textContent.trim() === "+ Row").click();
    [...editor.querySelectorAll("button")].find((button) => button.textContent.trim() === "+ Column").click();
  })()`);
  await delay(80);
  assert(
    await client.evaluate(`(() => {
      const editor = document.querySelector("[data-testid='table-editor']");
      return editor.querySelector(".semantic-table-content")?.textContent.includes("9.75") &&
        editor.querySelectorAll("[data-table-editor-row]").length === 4 &&
        editor.querySelectorAll("select[aria-label^='Column']").length === 4;
    })()`),
    "Rich-cell editing and structural table drafts did not live-update",
  );
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='table-editor']");
    editor.querySelector("button[aria-label='Remove column 4']").click();
    editor.querySelector("button[aria-label='Remove table row 4']").click();
  })()`);
  await delay(50);
  const tableDocumentRoot = await client.send("DOM.getDocument", { depth: -1, pierce: true });
  const tableFileInput = await client.send("DOM.querySelector", {
    nodeId: tableDocumentRoot.root.nodeId,
    selector: `input[data-testid="table-csv-file-input"]`,
  });
  assert(tableFileInput.nodeId !== 0, "The CSV extension did not expose its file input");
  await client.send("DOM.setFileInputFiles", {
    nodeId: tableFileInput.nodeId,
    files: [sampleCsvPath],
  });
  await delay(180);
  assert(
    await client.evaluate(`(() => {
      const editor = document.querySelector("[data-testid='table-editor']");
      return editor.textContent.includes("Imported 3 rows") &&
        editor.querySelectorAll("[data-table-editor-row]").length === 3 &&
        editor.querySelector(".semantic-table-content")?.textContent.includes("gemm") &&
        editor.querySelector(".semantic-table-content thead") !== null;
    })()`),
    "CSV import did not replace the grid and header role within its 30-row boundary",
  );
  await client.evaluate(`document.querySelector("button[data-testid='table-csv-export']").click()`);
  await delay(40);
  assert(
    await client.evaluate(`document.querySelector("[data-testid='table-editor']")?.textContent.includes("Exported the plain-text table projection")`),
    "CSV export did not consume the imported plain-text table",
  );
  await screenshot(client, "table-editor.png");
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='table-editor']");
    [...editor.querySelectorAll("button")].find((button) => button.textContent.includes("Save table")).click();
  })()`);
  await delay(120);
  assert(
    await client.evaluate(`(() => {
      const table = document.querySelector("[data-visual-block-id='sample-table']");
      return table.querySelectorAll("[data-table-cell-id]").length === 9 &&
        table.textContent.includes("gemm") &&
        table.querySelector("figcaption")?.textContent.includes("Table 1:");
    })()`),
    "The semantic table editor did not commit its imported rich-table draft",
  );

  await reloadBuilder(client);

  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-excalidraw-drawing']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(700);
  const drawingEditorInitial = await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-excalidraw-drawing']");
    return {
      inlineEditor: block.querySelector("[data-testid='excalidraw-drawing-editor']") !== null,
      excalidrawInstances: document.querySelectorAll(".excalidraw").length,
      height: Number.parseFloat(block.style.height),
    };
  })()`);
  assert(drawingEditorInitial.inlineEditor, "The drawing editor was not mounted in its document block");
  assert(drawingEditorInitial.excalidrawInstances === 2, "The bounded drawing scene was not isolated from the notes canvas");
  await client.evaluate(`(() => {
    const slider = document.querySelector("input[data-testid='drawing-height']");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(slider, "520");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await delay(180);
  assert(
    (await client.evaluate(`Number.parseFloat(document.querySelector("[data-block-id='sample-excalidraw-drawing']").style.height)`)) > drawingEditorInitial.height + 100,
    "A drawing height draft did not reflow the document immediately",
  );
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='excalidraw-drawing-editor']");
    [...editor.querySelectorAll("button")].find((button) => button.textContent.trim() === "Cancel").click();
  })()`);
  await delay(150);
  assert(
    Math.abs((await client.evaluate(`Number.parseFloat(document.querySelector("[data-block-id='sample-excalidraw-drawing']").style.height)`)) - drawingEditorInitial.height) < 1,
    "Cancelling an inline drawing draft did not restore the semantic layout",
  );

  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-excalidraw-drawing']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(650);
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='excalidraw-drawing-editor']");
    const caption = editor.querySelector("textarea");
    const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    textareaSetter.call(caption, "Edited directly inside the document.");
    caption.dispatchEvent(new Event("input", { bubbles: true }));
    const rectangle = editor.querySelector(".drawing-editor__canvas input[aria-label='Rectangle']");
    rectangle.click();
  })()`);
  const embeddedDrawingPoints = await client.evaluate(`(() => {
    const canvas = document.querySelector(".drawing-editor__canvas").getBoundingClientRect();
    return {
      start: { x: canvas.x + canvas.width * 0.48, y: canvas.y + canvas.height * 0.55 },
      end: { x: canvas.x + canvas.width * 0.76, y: canvas.y + canvas.height * 0.78 },
    };
  })()`);
  await pointerDrag(client, embeddedDrawingPoints.start, embeddedDrawingPoints.end);
  assert(
    !(await client.evaluate(`document.querySelector(".drawing-editor__canvas button[aria-label='Undo']").disabled`)),
    "The nested Excalidraw editor did not receive drawing input",
  );
  await screenshot(client, "inline-excalidraw-editor.png");
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='excalidraw-drawing-editor']");
    [...editor.querySelectorAll("button")].find((button) => button.textContent.includes("Save drawing")).click();
  })()`);
  await delay(450);
  assert(
    await client.evaluate(`(() => {
      const drawing = document.querySelector("[data-visual-block-id='sample-excalidraw-drawing']");
      return drawing.textContent.includes("Edited directly inside the document") &&
        drawing.querySelector("img")?.src.startsWith("blob:");
    })()`),
    "The inline drawing editor did not commit its scene and caption",
  );

  await reloadBuilder(client);

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

  await client.evaluate(`(() => {
    const select = document.querySelector("select[data-testid='layout-mode']");
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    selectSetter.call(select, "slides");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await delay(120);
  await client.evaluate(`(() => {
    const start = document.querySelector("input[data-testid='page-range-start']");
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    inputSetter.call(start, "1");
    start.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await delay(120);
  await client.evaluate(`(() => {
    const end = document.querySelector("input[data-testid='page-range-end']");
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    inputSetter.call(end, "1");
    end.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await delay(650);
  const slideLayout = await client.evaluate(`(() => {
    const slide = document.querySelector(".document-page--slide");
    const bounds = slide?.getBoundingClientRect();
    return {
      presentButton: document.querySelector("button[data-testid='start-presentation']") !== null,
      slideCount: document.querySelectorAll(".document-page--slide").length,
      ratio: bounds === undefined ? 0 : bounds.width / bounds.height,
      label: slide?.getAttribute("aria-label") ?? "",
    };
  })()`);
  assert(slideLayout.presentButton, "Slide mode did not expose fullscreen presentation");
  assert(slideLayout.slideCount === 1, "The selected slide slice did not project one slide");
  assert(Math.abs(slideLayout.ratio - 16 / 9) < 0.01, "Slide mode did not use 16:9 geometry");
  assert(slideLayout.label === "Slide 1", "Slide mode did not expose slide semantics");

  await client.evaluate(`document.querySelector("button[data-testid='start-presentation']").click()`);
  await delay(250);
  assert(
    await client.evaluate(`(() => {
      const overlay = document.querySelector("[data-testid='presentation-overlay']");
      return overlay !== null &&
        overlay.querySelectorAll(".document-page--slide").length === 1 &&
        overlay.querySelector(".presentation-controls output")?.textContent.trim().startsWith("1 /");
    })()`),
    "Fullscreen presentation did not open on the selected slide",
  );
  await client.evaluate(`globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))`);
  await delay(120);
  assert(
    await client.evaluate(`document.querySelector(".presentation-controls output")?.textContent.trim().startsWith("2 /") ?? false`),
    "Presentation keyboard navigation did not advance one slide",
  );
  await screenshot(client, "slide-presentation.png");
  await client.evaluate(`[
    ...document.querySelectorAll(".presentation-controls button")
  ].find((button) => button.textContent.trim() === "Exit").click()`);
  await delay(120);
  assert(
    !(await client.evaluate(`document.querySelector("[data-testid='presentation-overlay']") !== null`)),
    "Presentation exit did not restore the editor",
  );

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
    const footnoteText = document.querySelector("textarea[data-inline-id='sample-introduction-footnote-text']");
    textareaSetter.call(footnoteText, "Updated footnote with ");
    footnoteText.dispatchEvent(new Event("input", { bubbles: true }));
    const inlineCode = document.querySelector("input[data-inline-code-id='sample-introduction-inline-code']");
    inputSetter.call(inlineCode, "cudaGetLastError()");
    inlineCode.dispatchEvent(new Event("input", { bubbles: true }));
    const citation = document.querySelector("input[data-citation-editor-id='sample-introduction-citation']");
    inputSetter.call(citation, "orus2014");
    citation.dispatchEvent(new Event("input", { bubbles: true }));
    const inlineMath = document.querySelector("textarea[data-latex-math-inline-source='sample-introduction-inline-math']");
    textareaSetter.call(inlineMath, "\\\\alpha + \\\\beta");
    inlineMath.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await delay(80);
  const paragraphLive = await client.evaluate(`(() => {
    const preview = document.querySelector(".paragraph-live-preview");
    const colour = preview.querySelector(".inline-color-span");
    return {
      text: preview.textContent.includes("Edited by the browser smoke test"),
      colour: getComputedStyle(colour).color,
      segments: document.querySelectorAll("[data-inline-editor-id]").length,
      inlineMathEditor: document.querySelector("textarea[data-latex-math-inline-source='sample-introduction-inline-math']")?.value === "\\\\alpha + \\\\beta",
      inlineMathPreview: preview.querySelector("[data-latex-math-inline-id='sample-introduction-inline-math'] .katex-html")?.textContent.includes("α+β") ?? false,
      hyperlink: preview.querySelector("a[href='https://www.google.com']")?.textContent === "updated link",
      styled: preview.querySelector("em")?.textContent === "Styled text",
      reference: preview.querySelector("a.inline-reference")?.textContent === "Figure 1",
      footnote: preview.querySelector(".footnote-preview > sup > button")?.textContent.trim() === "1"
        && preview.querySelector(".footnote-preview__popover")?.textContent.includes("Updated footnote"),
      inlineCode: preview.querySelector(".inline-code-content")?.textContent === "cudaGetLastError()",
      citation: preview.querySelector(".inline-citation")?.textContent === "[2]",
    };
  })()`);
  assert(paragraphLive.text, "Paragraph live preview did not update before save");
  assert(paragraphLive.colour === "rgb(201, 42, 42)", "Colour-span preview did not update");
  assert(
    paragraphLive.segments === initialParagraphSegmentCount,
    "The paragraph did not expose all inline segments",
  );
  assert(
    paragraphLive.inlineMathEditor && paragraphLive.inlineMathPreview,
    "Text-authored inline math did not update its editor and live preview",
  );
  assert(paragraphLive.hyperlink, "Hyperlink target and label did not live-update");
  assert(paragraphLive.styled, "Core Text style did not live-update");
  assert(paragraphLive.reference, "Semantic reference numbering did not resolve live");
  assert(paragraphLive.footnote, "Footnote numbering or nested editing did not update live");
  assert(paragraphLive.inlineCode, "Inline-code editing did not update the live preview");
  assert(paragraphLive.citation, "Citation editing did not update the live resource lookup");

  await client.evaluate(`(() => {
    document.querySelector(".footnote-editor__add button").click();
  })()`);
  await delay(80);
  const addedFootnoteInlineId = await client.evaluate(`(() => {
    const segments = [...document.querySelectorAll("[data-footnote-inline-id]")];
    return segments.length === 4 ? segments.at(-1).dataset.footnoteInlineId : null;
  })()`);
  assert(addedFootnoteInlineId !== null, "Footnote editor did not add a nested segment");
  await client.evaluate(`(() => {
    const segment = document.querySelector("[data-footnote-inline-id='${addedFootnoteInlineId}']");
    const buttons = [...segment.querySelectorAll(":scope > header button")];
    buttons.find((button) => button.textContent.trim() === "←").click();
  })()`);
  await delay(80);
  assert(
    await client.evaluate(`[
      ...document.querySelectorAll("[data-footnote-inline-id]")
    ].at(-2).dataset.footnoteInlineId === '${addedFootnoteInlineId}'`),
    "Footnote editor did not reorder a nested segment",
  );
  await client.evaluate(`(() => {
    const segment = document.querySelector("[data-footnote-inline-id='${addedFootnoteInlineId}']");
    [...segment.querySelectorAll(":scope > header button")]
      .find((button) => button.textContent.trim() === "Remove")
      .click();
  })()`);
  await delay(80);
  assert(
    await client.evaluate(`document.querySelector("[data-footnote-inline-id='${addedFootnoteInlineId}']") === null`),
    "Footnote editor did not remove a nested segment",
  );

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
    return items.length === ${String(initialParagraphSegmentCount + 1)}
      ? items.at(-1).dataset.inlineEditorId
      : null;
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
  const paragraphEdited = await client.evaluate(`(() => {
    const paragraph = document.querySelector("[data-visual-block-id='sample-introduction']");
    return paragraph.textContent.includes("Edited by the browser smoke test") &&
      paragraph.querySelector(".inline-code-content")?.textContent === "cudaGetLastError()" &&
      paragraph.querySelector(".inline-citation")?.textContent === "[2]";
  })()`);
  assert(paragraphEdited, "Paragraph sequence-text editing did not commit");

  await reloadBuilder(client);
  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-bibliography']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(100);
  assert(
    await client.evaluate(`(() => {
      const editor = document.querySelector("[data-testid='bibliography-editor']");
      return editor !== null &&
        editor.querySelector("[aria-label='Bibliography source adapters']") !== null &&
        editor.querySelectorAll("[data-bibliography-editor-entry]").length === 2 &&
        editor.querySelector("[data-testid='bibliography-bibtex-export']") !== null &&
        editor.querySelector("[data-testid='bibliography-json-export']") !== null;
    })()`),
    "The bibliography editor or optional source capabilities were not composed",
  );
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='bibliography-editor']");
    editor.querySelector("button[aria-label='Move reference 1 down']").click();
  })()`);
  await delay(80);
  assert(
    await client.evaluate(`document.querySelector("[data-visual-block-id='sample-introduction'] .inline-citation")?.textContent === "[2, 1]"`),
    "Reordering bibliography records did not live-update citation ordinals",
  );
  const bibliographyRoot = await client.send("DOM.getDocument", { depth: -1, pierce: true });
  const bibliographyFileInput = await client.send("DOM.querySelector", {
    nodeId: bibliographyRoot.root.nodeId,
    selector: `input[data-testid="bibliography-bibtex-file-input"]`,
  });
  assert(bibliographyFileInput.nodeId !== 0, "The BibTeX source input was not created");
  await client.send("DOM.setFileInputFiles", {
    nodeId: bibliographyFileInput.nodeId,
    files: [sampleBibtexPath],
  });
  await delay(180);
  assert(
    await client.evaluate(`(() => {
      const editor = document.querySelector("[data-testid='bibliography-editor']");
      return editor.textContent.includes("Imported 2 entries") &&
        editor.textContent.includes("Imported tensor-network review");
    })()`),
    "BibTeX import did not replace and preview normalized records",
  );
  await screenshot(client, "bibliography-editor.png");
  await client.evaluate(`(() => {
    const editor = document.querySelector("[data-testid='bibliography-editor']");
    [...editor.querySelectorAll("button")].find((button) => button.textContent.includes("Save references")).click();
  })()`);
  await delay(100);
  assert(
    await client.evaluate(`(() => {
      const bibliography = document.querySelector("[data-visual-block-id='sample-bibliography']");
      const citation = document.querySelector("[data-visual-block-id='sample-introduction'] .inline-citation");
      return bibliography.textContent.includes("Imported tensor-network review") &&
        citation?.textContent === "[1, 2]";
    })()`),
    "Imported bibliography records did not commit with resolved citations",
  );

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
  assert(
    await client.evaluate(`(() => {
      const editor = document.querySelector(".image-editor");
      return editor.querySelectorAll(".inline-sequence-editor").length === 1 &&
        editor.querySelector(".image-editor-preview .latex-math-inline .katex") !== null &&
        editor.querySelector(".image-editor-preview .inline-color-span") !== null;
    })()`),
    "The ordinary-figure editor did not expose and preview its rich caption",
  );
  await client.evaluate(`(() => {
    const slider = document.querySelector(".image-editor input[type='range']");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(slider, "45");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    const caption = document.querySelector("textarea[data-inline-id='sample-figure-caption-text']");
    const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    textareaSetter.call(caption, "Edited rich figure ");
    caption.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await delay(50);
  assert(
    await client.evaluate(`(() => {
      const preview = document.querySelector(".image-editor-preview");
      return preview.querySelector("img").style.width === "45%" &&
        preview.textContent.includes("Edited rich figure");
    })()`),
    "Figure width or rich caption did not update its preview immediately",
  );
  await screenshot(client, "image-editor.png");
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
    await client.evaluate(`(() => {
      const figure = document.querySelector("[data-visual-block-id='sample-figure']");
      return figure.querySelector("img").src.startsWith("data:image/svg+xml") &&
        figure.textContent.includes("Edited rich figure") &&
        figure.querySelector("figcaption .latex-math-inline .katex") !== null &&
        figure.querySelector("figcaption .inline-color-span") !== null;
    })()`),
    "Selected image data or rich caption was not committed to the preview",
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
    textareaSetter.call(source, "__global__ void scale(float* values) {\\n    values[threadIdx.x] *= 2.0F;\\n}");
    source.dispatchEvent(new Event("input", { bubbles: true }));
    source.setSelectionRange(10, 11);
    source.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab",
      code: "Tab",
      bubbles: true,
      cancelable: true,
    }));
    const language = document.querySelector(".code-listing-editor select");
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    selectSetter.call(language, "cuda");
    language.dispatchEvent(new Event("change", { bubbles: true }));
    const reference = document.querySelector(".code-listing-editor input");
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    inputSetter.call(reference, "");
    reference.dispatchEvent(new Event("input", { bubbles: true }));
    const caption = document.querySelector("textarea[data-inline-id='sample-listing-caption-text']");
    textareaSetter.call(caption, "Edited CUDA block containing ");
    caption.dispatchEvent(new Event("input", { bubbles: true }));
    const inlineCode = document.querySelector("input[data-inline-code-id='sample-listing-caption-code']");
    inputSetter.call(inlineCode, "threadIdx.x");
    inlineCode.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await delay(60);
  assert(
    await client.evaluate(`document.querySelector("textarea[data-testid='code-listing-source']").value.startsWith("__global__    void")`),
    "Tab in the code-listing source editor did not insert four spaces",
  );
  assert(
    await client.evaluate(`(() => {
      const surface = document.querySelector(".code-editor-surface");
      return surface.querySelector("pre").textContent.startsWith("__global__    void") &&
        surface.querySelector(".syntax-token--keyword")?.textContent === "__global__" &&
        document.querySelector(".code-listing-editor__preview").textContent.includes("Edited CUDA block") &&
        document.querySelector(".code-listing-editor__preview .inline-code-content")?.textContent === "threadIdx.x";
    })()`),
    "The listing source or rich caption did not update its live preview",
  );
  await screenshot(client, "code-listing-editor.png");
  await client.evaluate(`[
    ...document.querySelector("[data-testid='block-editor-dialog']").querySelectorAll("button")
  ].find((button) => button.textContent.includes("Save listing")).click()`);
  assert(
    await client.evaluate(`(() => {
      const listing = document.querySelector("[data-visual-block-id='sample-code-listing']");
      const header = listing.querySelector(".code-listing-content__language").textContent;
      return listing.textContent.includes("__global__    void scale") &&
        header.includes("Listing 1") &&
        header.includes("CUDA") &&
        listing.querySelector("figcaption")?.textContent.includes("Edited CUDA block") &&
        listing.querySelector("figcaption .inline-code-content")?.textContent === "threadIdx.x";
    })()`),
    "The graphical code-listing editor did not commit CUDA and its rich caption",
  );

  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-code-listing']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(80);
  await client.evaluate(`(() => {
    const editor = document.querySelector(".code-listing-editor");
    [...editor.querySelectorAll("button")].find((button) => button.textContent.includes("Remove caption")).click();
  })()`);
  await delay(40);
  await client.evaluate(`(() => {
    const editor = document.querySelector(".code-listing-editor");
    [...editor.querySelectorAll("button")].find((button) => button.textContent.includes("Save listing")).click();
  })()`);
  await delay(80);
  assert(
    await client.evaluate(`document.querySelector("[data-visual-block-id='sample-code-listing'] figcaption") === null`),
    "Removing the optional rich listing caption did not commit",
  );

  await reloadBuilder(client);
  await client.evaluate(`(() => {
    const block = document.querySelector("[data-block-id='sample-display-math']");
    [...block.querySelectorAll("button")].find((button) => button.textContent.trim() === "Edit").click();
  })()`);
  await delay(100);
  assert(
    await client.evaluate(`(() => {
      const editor = document.querySelector(".latex-math-block-editor");
      return editor !== null &&
        editor.querySelector("textarea[data-latex-math-display-source='sample-display-math']") !== null &&
        editor.querySelector(".latex-math-source-editor__preview .katex") !== null &&
        editor.textContent.includes("Implicit $$ … $$");
    })()`),
    "The text-authored display-math editor did not expose source and live preview",
  );
  await client.evaluate(`(() => {
    const textarea = document.querySelector("textarea[data-latex-math-display-source='sample-display-math']");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, "F = ma");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await delay(80);
  assert(
    await client.evaluate(`(() => {
      const preview = document.querySelector(".latex-math-source-editor__preview");
      return preview.querySelector(".katex-html")?.textContent.includes("F=ma") ?? false;
    })()`),
    "Editing LaTeX display source did not update the KaTeX preview",
  );
  await screenshot(client, "latex-math-editor.png");
  await client.evaluate(`[
    ...document.querySelector("[data-testid='block-editor-dialog']").querySelectorAll("button")
  ].find((button) => button.textContent.includes("Save equation")).click()`);
  await delay(80);
  assert(
    await client.evaluate(`document.querySelector("[data-visual-block-id='sample-display-math'] .katex-html")?.textContent.includes("F=ma") ?? false`),
    "The text-authored display equation did not commit",
  );

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
  const canonicalLoadState = await client.evaluate(`(() => {
      const blocks = [...document.querySelectorAll("[data-block-id]")];
      return {
        blockCount: blocks.length >= 11,
        title: document.body.textContent.includes("Canonical document"),
        paragraph: document.body.textContent.includes("A styled canonical paragraph"),
        opaque: document.body.textContent.includes("third.party.block"),
        save: document.querySelector("button[data-testid='save-document']") !== null,
        structuredDisplayPreserved: document.querySelector("[data-visual-block-id='fixture-equation']")?.textContent.includes("dans.math.display") === true,
        structuredInlinePreserved: document.querySelector("[data-visual-block-id='fixture-introduction']")?.textContent.includes("dans.math.inline") === true,
        citation: document.querySelector("[data-visual-block-id='fixture-introduction'] .inline-citation")?.textContent === "[1, 2]",
        bibliography: document.querySelectorAll("[data-visual-block-id='fixture-bibliography'] [data-bibliography-entry-key]").length === 2,
      };
    })()`);
  const failedCanonicalChecks = Object.entries(canonicalLoadState)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  assert(
    failedCanonicalChecks.length === 0,
    `Canonical document loading did not transactionally replace the graphical document: ${failedCanonicalChecks.join(", ")}`,
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
  await writeFile(
    sampleCsvPath,
    "Kernel,Lattice,Runtime (ms)\ngemm,64 x 64,3.50\nsvd,\"128, 128\",10.25\n",
  );
  await writeFile(
    sampleBibtexPath,
    "@article{verstraete2008,\n" +
      "  author = {Frank Verstraete and J. Ignacio Cirac},\n" +
      "  title = {Imported tensor-network review},\n" +
      "  journal = {Advances in Physics},\n" +
      "  year = {2008},\n" +
      "  doi = {10.1080/14789940801912366}\n" +
      "}\n\n" +
      "@article{orus2014,\n" +
      "  author = {Roman Orus},\n" +
      "  title = {Imported practical introduction},\n" +
      "  journal = {Annals of Physics},\n" +
      "  year = {2014}\n" +
      "}\n",
  );
  await exerciseBuilder(client);
  process.stdout.write(`Browser smoke test passed; screenshots are in ${resultsDirectory}\n`);
} finally {
  client?.close();
  await stopProcess(chromeProcess);
  await stopProcess(viteProcess);
  await rm(profileDirectory, { recursive: true, force: true });
}
