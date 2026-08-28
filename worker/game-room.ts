import { DurableObject } from "cloudflare:workers";
import {
  GameRuleError,
  addPlayer,
  createRoomState,
  rollDice,
  setPlayerConnected,
  startGame,
  type AddPlayerInput,
  type ClientRoomMessage,
  type CreateRoomInput,
  type GameRoomState,
  type ServerRoomMessage,
} from "../shared/game-room";

type Session = {
  participantId: string;
  createdAt: string;
};

type SocketAttachment = {
  participantId: string;
};

const STATE_KEY = "room-state";
const SESSION_PREFIX = "session:";
const ACTIONS_KEY = "recent-actions";
const SESSION_LIFETIME_MS = 6 * 60 * 60 * 1000;
const MAX_RECENT_ACTIONS = 128;

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function randomTicket() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class GameRoom extends DurableObject<Cloudflare.Env> {
  private state: GameRoomState | null = null;
  private recentActionIds: string[] = [];
  private readonly environment: Cloudflare.Env;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.environment = env;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get([STATE_KEY, ACTIONS_KEY]);
      this.state = stored.get(STATE_KEY) as GameRoomState | null ?? null;
      this.recentActionIds = stored.get(ACTIONS_KEY) as string[] | undefined ?? [];
    });
  }

  private requireState() {
    if (!this.state) throw new GameRuleError("ROOM_NOT_INITIALIZED", "게임방이 준비되지 않았습니다.");
    return this.state;
  }

  private async saveState(state: GameRoomState, actionId?: string) {
    this.state = state;
    if (!actionId) {
      await this.ctx.storage.put(STATE_KEY, state);
      return;
    }
    this.recentActionIds = [...this.recentActionIds, actionId].slice(-MAX_RECENT_ACTIONS);
    await this.ctx.storage.put({
      [STATE_KEY]: state,
      [ACTIONS_KEY]: this.recentActionIds,
    });
  }

  private send(socket: WebSocket, message: ServerRoomMessage) {
    socket.send(JSON.stringify(message));
  }

  private broadcastState() {
    const state = this.requireState();
    const payload = JSON.stringify({ type: "ROOM_STATE", state } satisfies ServerRoomMessage);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        // The close event will reconcile presence for sockets that disappeared.
      }
    }
  }

  private async createSession(participantId: string) {
    const ticket = randomTicket();
    const session: Session = { participantId, createdAt: new Date().toISOString() };
    await this.ctx.storage.put(`${SESSION_PREFIX}${ticket}`, session);
    return ticket;
  }

  private async initialize(request: Request) {
    const input = await request.json<CreateRoomInput>();
    if (!this.state) await this.saveState(createRoomState(input));
    const state = this.requireState();
    if (state.roomId !== input.roomId || state.gameId !== input.gameId) {
      return json({ error: { code: "ROOM_ID_CONFLICT", message: "다른 게임방이 이미 이 객체를 사용하고 있습니다." } }, 409);
    }
    const ticket = await this.createSession(input.host.id);
    return json({ ticket, state });
  }

  private async register(request: Request) {
    const input = await request.json<AddPlayerInput>();
    const next = addPlayer(this.requireState(), input);
    if (next !== this.state) await this.saveState(next);
    const ticket = await this.createSession(input.id);
    this.broadcastState();
    return json({ ticket, state: this.requireState() });
  }

  private async acceptConnection(request: Request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }
    const ticket = new URL(request.url).searchParams.get("ticket") ?? "";
    const session = ticket ? await this.ctx.storage.get<Session>(`${SESSION_PREFIX}${ticket}`) : null;
    const sessionAge = session ? Date.now() - new Date(session.createdAt).getTime() : Number.POSITIVE_INFINITY;
    if (!session || sessionAge > SESSION_LIFETIME_MS) {
      if (ticket) await this.ctx.storage.delete(`${SESSION_PREFIX}${ticket}`);
      return new Response("Invalid or expired room ticket", { status: 401 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    const attachment: SocketAttachment = { participantId: session.participantId };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server);

    const next = setPlayerConnected(this.requireState(), session.participantId, true);
    if (next !== this.state) await this.saveState(next);
    this.send(server, { type: "ROOM_STATE", state: this.requireState() });
    this.broadcastState();

    return new Response(null, { status: 101, webSocket: client });
  }

  async fetch(request: Request) {
    try {
      const pathname = new URL(request.url).pathname;
      if (request.method === "POST" && pathname === "/initialize") return await this.initialize(request);
      if (request.method === "POST" && pathname === "/register") return await this.register(request);
      if (request.method === "GET" && pathname === "/connect") return await this.acceptConnection(request);
      return new Response("Not found", { status: 404 });
    } catch (error) {
      if (error instanceof GameRuleError) {
        return json({ error: { code: error.code, message: error.message } }, 400);
      }
      console.error("GameRoom request failed", error);
      return json({ error: { code: "ROOM_SERVER_ERROR", message: "실시간 게임방 요청을 처리하지 못했습니다." } }, 500);
    }
  }

  async webSocketMessage(socket: WebSocket, rawMessage: ArrayBuffer | string) {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    if (!attachment) {
      socket.close(1008, "Missing participant session");
      return;
    }

    try {
      const message = JSON.parse(typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage)) as ClientRoomMessage;
      if (message.type === "SYNC") {
        this.send(socket, { type: "ROOM_STATE", state: this.requireState() });
        return;
      }
      if (!message.actionId || message.actionId.length > 128) {
        throw new GameRuleError("INVALID_ACTION_ID", "게임 명령 식별자가 올바르지 않습니다.");
      }
      if (this.recentActionIds.includes(message.actionId)) {
        this.send(socket, { type: "ROOM_STATE", state: this.requireState() });
        return;
      }

      const current = this.requireState();
      const next = message.type === "START_GAME"
        ? startGame(current, attachment.participantId, message.expectedVersion)
        : message.type === "ROLL_DICE"
          ? rollDice(current, attachment.participantId, crypto.getRandomValues(new Uint32Array(1))[0] % 6 + 1, message.expectedVersion)
          : null;

      if (!next) throw new GameRuleError("UNKNOWN_MESSAGE", "지원하지 않는 게임 명령입니다.");
      await this.saveState(next, message.actionId);
      if (message.type === "START_GAME") {
        this.ctx.waitUntil(
          this.environment.DB.prepare("UPDATE rooms SET status = ? WHERE id = ?")
            .bind("PLAYING", next.roomId)
            .run()
            .catch((error) => console.error("Failed to persist room lifecycle status", error)),
        );
      }
      this.broadcastState();
    } catch (error) {
      const gameError = error instanceof GameRuleError
        ? error
        : new GameRuleError("INVALID_MESSAGE", "게임 명령 형식이 올바르지 않습니다.");
      this.send(socket, {
        type: "ROOM_ERROR",
        code: gameError.code,
        message: gameError.message,
        state: this.state ?? undefined,
      });
    }
  }

  async webSocketClose(socket: WebSocket) {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    if (!attachment || !this.state) return;
    const hasAnotherSocket = this.ctx.getWebSockets().some((candidate) => {
      if (candidate === socket) return false;
      const candidateAttachment = candidate.deserializeAttachment() as SocketAttachment | null;
      return candidateAttachment?.participantId === attachment.participantId;
    });
    if (hasAnotherSocket) return;

    const next = setPlayerConnected(this.state, attachment.participantId, false);
    if (next !== this.state) await this.saveState(next);
    this.broadcastState();
  }
}
