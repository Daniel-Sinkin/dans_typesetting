// Host a real Neovim TUI backed by the local Vite PTY bridge.
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

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
}

interface NvimEditorCallbacks {
  readonly sourceEditor: BuilderBlockSourceEditor;
  readonly onPreview: (block: BuilderBlock) => void;
  readonly onCommit: (block: BuilderBlock) => void;
  readonly onCancel: () => void;
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

export function NvimBlockEditor({
  block,
  sourceEditor,
  onPreview,
  onCommit,
  onCancel,
}: NvimBlockEditorProps) {
  const terminalHostRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const cancelledRef = useRef(false);
  const exitReceivedRef = useRef(false);
  const draftRef = useRef<BuilderBlock>(block);
  const validDraftRef = useRef(true);
  const callbacksRef = useRef<NvimEditorCallbacks>({
    sourceEditor,
    onPreview,
    onCommit,
    onCancel,
  });
  const [session] = useState(() => ({
    block,
    fileName: sourceEditor.fileName(block),
    source: sourceEditor.source(block),
  }));
  const [status, setStatus] = useState("Connecting to local Neovim…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbacksRef.current = { sourceEditor, onPreview, onCommit, onCancel };
  }, [onCancel, onCommit, onPreview, sourceEditor]);

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

    socket.addEventListener("open", () => {
      fitAddon.fit();
      send(socket, {
        type: "start",
        source: session.source,
        fileName: session.fileName,
        columns: Math.max(20, terminal.cols),
        rows: Math.max(5, terminal.rows),
      });
      terminal.focus();
    });
    socket.addEventListener("message", (event) => {
      try {
        const message = parseNvimServerMessage(JSON.parse(String(event.data)) as unknown);
        if (message.type === "data") {
          terminal.write(message.data);
          return;
        }
        if (message.type === "ready") {
          setStatus(`${message.fileName} · normal config loaded`);
          terminal.focus();
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
            setStatus(":write synchronized to the document preview");
            callbacksRef.current.onPreview(replacement);
          } catch (cause: unknown) {
            validDraftRef.current = false;
            setError(cause instanceof Error ? cause.message : "The written source is invalid");
          }
          return;
        }
        if (message.type === "exit") {
          exitReceivedRef.current = true;
          if (cancelledRef.current || disposed) {
            return;
          }
          if (message.exitCode === 0 && validDraftRef.current) {
            setStatus("Neovim exited; committing the last written buffer…");
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
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : "Malformed Neovim response");
      }
    });
    socket.addEventListener("error", () => {
      if (!disposed) {
        setError("The local Neovim bridge is unavailable. Run the builder through its Vite dev or preview server.");
      }
    });
    socket.addEventListener("close", () => {
      if (!disposed && !cancelledRef.current && !exitReceivedRef.current) {
        setError("The local Neovim session closed unexpectedly");
      }
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      inputSubscription.dispose();
      if (socket.readyState === WebSocket.OPEN) {
        send(socket, { type: "terminate" });
      }
      socket.close();
      terminal.dispose();
      socketRef.current = null;
    };
  }, [session]);

  const cancel = (): void => {
    cancelledRef.current = true;
    const socket = socketRef.current;
    if (socket !== null) {
      send(socket, { type: "terminate" });
      socket.close();
    }
    callbacksRef.current.onCancel();
  };

  return (
    <section className="nvim-block-editor" data-testid="nvim-block-editor">
      <header>
        <div>
          <strong>NEOVIM · {session.fileName}</strong>
          <span>{status}</span>
        </div>
        <span className="nvim-block-editor__mode">real PTY · ~/.config/nvim</span>
      </header>
      <div
        ref={terminalHostRef}
        className="nvim-block-editor__terminal"
        data-testid="nvim-terminal"
        aria-label={`Neovim terminal editing ${session.fileName}`}
      />
      <footer>
        <span><kbd>:w</kbd> preview · <kbd>:wq</kbd> commit · ordinary Neovim keys and commands apply</span>
        {error === null ? null : <strong role="alert">{error}</strong>}
        <button type="button" onClick={cancel}>Cancel session</button>
      </footer>
    </section>
  );
}
