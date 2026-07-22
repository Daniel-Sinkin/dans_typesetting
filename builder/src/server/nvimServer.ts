// Local Vite bridge between an xterm surface and the user's real Neovim TUI.
import { watch, type FSWatcher } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Duplex } from "node:stream";

import { spawn, type IPty } from "node-pty";
import type { HttpServer, Plugin, PreviewServer, ViteDevServer } from "vite";
import WebSocket, { WebSocketServer } from "ws";
import type { RawData } from "ws";

import {
  nvimWebSocketPath,
  parseNvimClientMessage,
  type NvimServerMessage,
  type NvimStartMessage,
} from "../editor/nvimProtocol";

interface NvimSession {
  readonly terminal: IPty;
  readonly directory: string;
  readonly filePath: string;
  watcher: FSWatcher | null;
  writeTimer: ReturnType<typeof setTimeout> | null;
  lastSource: string;
  disposed: boolean;
}

function send(socket: WebSocket, message: NvimServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Neovim bridge error";
}

function rawMessageText(raw: RawData): string {
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString("utf8");
  }
  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString("utf8");
  }
  return raw.toString("utf8");
}

async function removeSessionFiles(session: NvimSession): Promise<void> {
  await rm(session.directory, { recursive: true, force: true });
}

function disposeSession(session: NvimSession, terminate: boolean): void {
  if (session.disposed) {
    return;
  }
  session.disposed = true;
  if (session.writeTimer !== null) {
    clearTimeout(session.writeTimer);
  }
  session.watcher?.close();
  if (terminate) {
    try {
      session.terminal.kill();
    } catch {
      // The PTY may already have exited between the ready-state check and kill.
    }
  }
  void removeSessionFiles(session).catch(() => {
    // A process shutdown can race temporary-directory cleanup.
  });
}

async function readAndPublish(socket: WebSocket, session: NvimSession): Promise<void> {
  try {
    const source = await readFile(session.filePath, "utf8");
    if (source !== session.lastSource) {
      session.lastSource = source;
      send(socket, { type: "write", source });
    }
  } catch (error) {
    if (!session.disposed) {
      send(socket, { type: "error", message: errorMessage(error) });
    }
  }
}

function scheduleSourceRead(socket: WebSocket, session: NvimSession): void {
  if (session.writeTimer !== null) {
    clearTimeout(session.writeTimer);
  }
  session.writeTimer = setTimeout(() => {
    session.writeTimer = null;
    void readAndPublish(socket, session);
  }, 35);
}

async function startSession(
  socket: WebSocket,
  request: NvimStartMessage,
  workspaceRoot: string,
): Promise<NvimSession> {
  const directory = await mkdtemp(join(tmpdir(), "dans-builder-nvim-"));
  const filePath = join(directory, request.fileName);
  await writeFile(filePath, request.source, "utf8");
  let terminal: IPty;
  try {
    terminal = spawn(
      "nvim",
      [
        "-i",
        "NONE",
        "--cmd",
        "set noswapfile",
        "--cmd",
        "let g:dans_builder = 1",
        "--cmd",
        "let g:dans_protect = v:false",
        filePath,
      ],
      {
        name: "xterm-256color",
        cols: request.columns,
        rows: request.rows,
        cwd: workspaceRoot,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          DANS_BUILDER_NVIM: "1",
        },
      },
    );
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  const session: NvimSession = {
    terminal,
    directory,
    filePath,
    watcher: null,
    writeTimer: null,
    lastSource: request.source,
    disposed: false,
  };
  session.watcher = watch(filePath, () => {
    scheduleSourceRead(socket, session);
  });
  let readySent = false;
  terminal.onData((data) => {
    send(socket, { type: "data", data });
    if (!readySent) {
      readySent = true;
      send(socket, { type: "ready", fileName: request.fileName });
    }
  });
  terminal.onExit(({ exitCode, signal }) => {
    void (async () => {
      await readAndPublish(socket, session);
      send(socket, { type: "exit", exitCode, signal: signal ?? null });
      disposeSession(session, false);
      socket.close(1000, "Neovim exited");
    })();
  });
  return session;
}

function attachConnection(socket: WebSocket, workspaceRoot: string): void {
  let session: NvimSession | null = null;
  let startingSession: Promise<NvimSession> | null = null;
  let closed = false;

  socket.on("message", (raw) => {
    void (async () => {
      try {
        const message = parseNvimClientMessage(
          JSON.parse(rawMessageText(raw)) as unknown,
        );
        if (message.type === "start") {
          if (session !== null || startingSession !== null) {
            throw new Error("A Neovim session is already active on this connection");
          }
          startingSession = startSession(socket, message, workspaceRoot);
          try {
            const startedSession = await startingSession;
            if (closed) {
              disposeSession(startedSession, true);
            } else {
              session = startedSession;
            }
          } finally {
            startingSession = null;
          }
          return;
        }
        const activeSession = session ?? await startingSession;
        if (activeSession === null || closed) {
          throw new Error("Start the Neovim session before sending terminal input");
        }
        if (message.type === "input") {
          activeSession.terminal.write(message.data);
        } else if (message.type === "resize") {
          activeSession.terminal.resize(message.columns, message.rows);
        } else {
          disposeSession(activeSession, true);
          session = null;
          socket.close(1000, "Session cancelled");
        }
      } catch (error) {
        send(socket, { type: "error", message: errorMessage(error) });
      }
    })();
  });
  socket.on("close", () => {
    closed = true;
    if (session !== null) {
      disposeSession(session, true);
      session = null;
    }
  });
  socket.on("error", () => {
    // The close handler owns PTY cleanup.
  });
}

function registerNvimServer(
  httpServer: HttpServer | null,
  workspaceRoot: string,
): void {
  if (httpServer === null) {
    return;
  }
  const webSocketServer = new WebSocketServer({ noServer: true });
  const handleUpgrade = (
    request: IncomingMessage,
    networkSocket: Duplex,
    head: Buffer,
  ): void => {
    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "127.0.0.1"}`,
    );
    if (url.pathname !== nvimWebSocketPath) {
      return;
    }
    webSocketServer.handleUpgrade(request, networkSocket, head, (socket) => {
      attachConnection(socket, workspaceRoot);
    });
  };
  httpServer.on("upgrade", handleUpgrade);
  httpServer.once("close", () => {
    httpServer.off("upgrade", handleUpgrade);
    webSocketServer.close();
  });
}

function install(server: ViteDevServer | PreviewServer): void {
  registerNvimServer(server.httpServer, server.config.root);
}

export function nvimEditorServerPlugin(): Plugin {
  return {
    name: "dans-nvim-editor-server",
    configureServer(server) {
      install(server);
    },
    configurePreviewServer(server) {
      install(server);
    },
  };
}
