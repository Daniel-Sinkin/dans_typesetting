// Host a real Neovim TUI backed by the local Vite PTY bridge.
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  BuilderBlockEditorProps,
  BuilderBlockSourceEditor,
} from "../builder/plugin";
import type { BuilderBlock } from "../model/document";
import {
  nvimWebSocketPath,
  parseNvimServerMessage,
  type NvimClientMessage,
} from "../editor/nvimProtocol";

interface NvimBlockEditorProps extends BuilderBlockEditorProps {
  readonly sourceEditor: BuilderBlockSourceEditor;
  readonly visible: boolean;
}

interface NvimEditorCallbacks {
  readonly sourceEditor: BuilderBlockSourceEditor;
  readonly onPreview: (block: BuilderBlock) => void;
  readonly onCommit: (block: BuilderBlock) => void;
}

function socketUrl(): string {
  const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${globalThis.location.host}${nvimWebSocketPath}`;
}

function send(socket: WebSocket, message: NvimClientMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function normalizedTerminalText(value: string): string {
  return value.replace(/\s/gu, "");
}

function sourceMarker(source: string): string {
  const firstContentLine = source.split(/\r?\n/u).find((line) => /\S/u.test(line)) ?? "";
  return normalizedTerminalText(firstContentLine).slice(0, 32);
}

function terminalContainsSource(terminal: Terminal, marker: string): boolean {
  if (marker.length === 0) {
    return true;
  }
  const buffer = terminal.buffer.active;
  let visibleText = "";
  for (let index = 0; index < buffer.length; index += 1) {
    const line = buffer.getLine(index)?.translateToString(true) ?? "";
    visibleText += normalizedTerminalText(line);
    if (visibleText.includes(marker)) {
      return true;
    }
    visibleText = visibleText.slice(-marker.length);
  }
  return false;
}

export function NvimBlockEditor({
  block,
  sourceEditor,
  visible,
  onPreview,
  onCommit,
}: NvimBlockEditorProps) {
  const terminalHostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const visibleRef = useRef(visible);
  const serverReadyRef = useRef(false);
  const bufferReadyRef = useRef(false);
  const revealFrameRef = useRef<number | null>(null);
  const revealPaintFrameRef = useRef<number | null>(null);
  const exitReceivedRef = useRef(false);
  const draftRef = useRef<BuilderBlock>(block);
  const validDraftRef = useRef(true);
  const callbacksRef = useRef<NvimEditorCallbacks>({
    sourceEditor,
    onPreview,
    onCommit,
  });
  const [session] = useState(() => ({
    block,
    fileName: sourceEditor.fileName(block),
    source: sourceEditor.source(block),
  }));
  const [bufferReady, setBufferReady] = useState(false);
  const [renderReady, setRenderReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbacksRef.current = { sourceEditor, onPreview, onCommit };
  }, [onCommit, onPreview, sourceEditor]);

  const schedulePaintedReveal = useCallback((): void => {
    if (!visibleRef.current || !bufferReadyRef.current) {
      return;
    }
    if (revealFrameRef.current !== null) {
      cancelAnimationFrame(revealFrameRef.current);
    }
    if (revealPaintFrameRef.current !== null) {
      cancelAnimationFrame(revealPaintFrameRef.current);
    }
    revealFrameRef.current = requestAnimationFrame(() => {
      revealFrameRef.current = null;
      revealPaintFrameRef.current = requestAnimationFrame(() => {
        revealPaintFrameRef.current = null;
        if (visibleRef.current && bufferReadyRef.current) {
          setRenderReady(true);
        }
      });
    });
  }, []);

  const detectLoadedBuffer = useCallback((): void => {
    const terminal = terminalRef.current;
    if (
      !serverReadyRef.current ||
      terminal === null ||
      !terminalContainsSource(terminal, sourceMarker(session.source))
    ) {
      return;
    }
    bufferReadyRef.current = true;
    setBufferReady(true);
    schedulePaintedReveal();
  }, [schedulePaintedReveal, session.source]);

  useEffect(() => {
    visibleRef.current = visible;
    if (!visible) {
      return;
    }
    let paintFrame: number | null = null;
    const fallback = globalThis.setTimeout(() => {
      if (visibleRef.current && serverReadyRef.current) {
        bufferReadyRef.current = true;
        setBufferReady(true);
        schedulePaintedReveal();
      }
    }, 1_200);
    const frame = requestAnimationFrame(() => {
      try {
        fitAddonRef.current?.fit();
        terminalRef.current?.focus();
        const socket = socketRef.current;
        const terminal = terminalRef.current;
        if (socket !== null && terminal !== null) {
          send(socket, {
            type: "resize",
            columns: Math.max(20, terminal.cols),
            rows: Math.max(5, terminal.rows),
          });
        }
        paintFrame = requestAnimationFrame(() => {
          detectLoadedBuffer();
          schedulePaintedReveal();
        });
      } catch {
        // The host can take one animation frame to acquire its visible size.
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      if (paintFrame !== null) {
        cancelAnimationFrame(paintFrame);
      }
      globalThis.clearTimeout(fallback);
    };
  }, [detectLoadedBuffer, schedulePaintedReveal, visible]);

  useEffect(() => {
    const terminalHost = terminalHostRef.current;
    if (terminalHost === null) {
      return;
    }
    let disposed = false;
    const terminal = new Terminal({
      allowTransparency: false,
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"Monaspace Krypton", "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.14,
      scrollback: 4_000,
      theme: {
        background: "#1a1b26",
        foreground: "#c0caf5",
        cursor: "#c0caf5",
        selectionBackground: "#364a82",
      },
    });
    const fitAddon = new FitAddon();
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);
    terminal.open(terminalHost);
    const socket = new WebSocket(socketUrl());
    socketRef.current = socket;
    const fit = (): void => {
      try {
        fitAddon.fit();
        send(socket, {
          type: "resize",
          columns: Math.max(20, terminal.cols),
          rows: Math.max(5, terminal.rows),
        });
      } catch {
        // A transient zero-sized dialog during mounting will be fitted again.
      }
    };
    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(terminalHost);
    const inputSubscription = terminal.onData((data) => {
      send(socket, { type: "input", data });
    });
    const renderSubscription = terminal.onRender(() => {
      detectLoadedBuffer();
    });

    socket.addEventListener("open", () => {
      fitAddon.fit();
      send(socket, {
        type: "start",
        source: session.source,
        fileName: session.fileName,
        columns: Math.max(20, terminal.cols),
        rows: Math.max(5, terminal.rows),
      });
      if (visibleRef.current) {
        terminal.focus();
      }
    });
    socket.addEventListener("message", (event) => {
      try {
        const message = parseNvimServerMessage(JSON.parse(String(event.data)) as unknown);
        if (message.type === "data") {
          terminal.write(message.data, detectLoadedBuffer);
          return;
        }
        if (message.type === "ready") {
          serverReadyRef.current = true;
          requestAnimationFrame(detectLoadedBuffer);
          if (visibleRef.current) {
            terminal.focus();
          }
          return;
        }
        if (message.type === "write") {
          try {
            const replacement = callbacksRef.current.sourceEditor.applySource(
              session.block,
              message.source,
            );
            if (
              replacement.id !== session.block.id ||
              replacement.typeId !== session.block.typeId
            ) {
              throw new Error("A source editor must preserve the block identity");
            }
            draftRef.current = replacement;
            validDraftRef.current = true;
            setError(null);
            callbacksRef.current.onPreview(replacement);
          } catch (cause: unknown) {
            validDraftRef.current = false;
            setError(cause instanceof Error ? cause.message : "The written source is invalid");
          }
          return;
        }
        if (message.type === "exit") {
          exitReceivedRef.current = true;
          if (disposed) {
            return;
          }
          if (message.exitCode === 0 && validDraftRef.current) {
            callbacksRef.current.onCommit(draftRef.current);
          } else {
            setError(
              message.exitCode === 0
                ? "Neovim exited with invalid source; cancel or reopen the editor"
                : `Neovim exited with status ${String(message.exitCode)}`,
            );
          }
          return;
        }
        setError(message.message);
        bufferReadyRef.current = true;
        setBufferReady(true);
        setRenderReady(true);
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : "Malformed Neovim response");
        bufferReadyRef.current = true;
        setBufferReady(true);
        setRenderReady(true);
      }
    });
    socket.addEventListener("error", () => {
      if (!disposed) {
        setError("The local Neovim bridge is unavailable. Run the builder through its Vite dev or preview server.");
        bufferReadyRef.current = true;
        setBufferReady(true);
        setRenderReady(true);
      }
    });
    socket.addEventListener("close", () => {
      if (!disposed && !exitReceivedRef.current) {
        setError("The local Neovim session closed unexpectedly");
      }
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      inputSubscription.dispose();
      renderSubscription.dispose();
      if (socket.readyState === WebSocket.OPEN) {
        send(socket, { type: "terminate" });
      }
      socket.close();
      terminal.dispose();
      if (revealFrameRef.current !== null) {
        cancelAnimationFrame(revealFrameRef.current);
      }
      if (revealPaintFrameRef.current !== null) {
        cancelAnimationFrame(revealPaintFrameRef.current);
      }
      terminalRef.current = null;
      fitAddonRef.current = null;
      socketRef.current = null;
    };
  }, [detectLoadedBuffer, session]);

  return (
    <section
      className="nvim-block-editor"
      data-testid="nvim-block-editor"
      data-visible={visible ? "true" : "false"}
      data-buffer-ready={bufferReady ? "true" : "false"}
      data-render-ready={renderReady ? "true" : "false"}
      aria-busy={!renderReady}
    >
      <div
        ref={terminalHostRef}
        className="nvim-block-editor__terminal"
        data-testid="nvim-terminal"
        aria-label={`Neovim terminal editing ${session.fileName}`}
      />
      {error === null ? null : (
        <strong className="nvim-block-editor__error" role="alert">{error}</strong>
      )}
    </section>
  );
}
