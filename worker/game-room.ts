import { DurableObject } from "cloudflare:workers";
import {
  GameRuleError,
  addPlayer,
  answerQuestion,
  createRoomState,
  endGame,
  normalizeRoomState,
  isCorrectAnswer,
  resolveAllAnswers,
  rollDice,
  setPlayerConnected,
  startGame,
  submitAllAnswer,
  timeoutQuestion,
  type AddPlayerInput,
  type ClientRoomMessage,
  type CreateRoomInput,
  type GameRoomState,
  type RoomContent,
  type ServerRoomMessage,
} from "../shared/game-room";

type Session = {
  participantId: string;
  createdAt: string;
};

type SocketAttachment = {
  participantId: string;
};

type PendingAnswer = {
  answer: string;
  submittedAt: string;
};

const STATE_KEY = "room-state";
const SESSION_PREFIX = "session:";
const ACTIONS_KEY = "recent-actions";
const CONTENT_KEY = "room-content";
const PENDING_ANSWERS_KEY = "pending-answers";
const HOST_EXPIRY_ALARM_KEY = "host-expiry-alarm";
const SESSION_LIFETIME_MS = 6 * 60 * 60 * 1000;
const HOST_DISCONNECT_EXPIRY_MS = 60 * 1000;
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
  private content: RoomContent = { questions: [], cards: [] };
  private pendingAnswers: Record<string, PendingAnswer> = {};
  private readonly environment: Cloudflare.Env;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.environment = env;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get([STATE_KEY, ACTIONS_KEY, CONTENT_KEY, PENDING_ANSWERS_KEY]);
      const storedState = stored.get(STATE_KEY) as GameRoomState | null ?? null;
      this.state = storedState ? normalizeRoomState(storedState) : null;
      this.recentActionIds = stored.get(ACTIONS_KEY) as string[] | undefined ?? [];
      this.content = stored.get(CONTENT_KEY) as RoomContent | undefined ?? { questions: [], cards: [] };
      this.pendingAnswers = stored.get(PENDING_ANSWERS_KEY) as Record<string, PendingAnswer> | undefined ?? {};
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

  private async reconcileQuestionAlarm(state: GameRoomState) {
    if (state.status === "PLAYING" && state.phase === "WAITING_FOR_ANSWER" && state.questionDeadlineAt) {
      await this.ctx.storage.setAlarm(new Date(state.questionDeadlineAt));
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  private async persistFinalResults(state: GameRoomState) {
    const sortedPlayers = [...state.players].sort((left, right) => (
      (state.gameMode.playMode === "TEAM" ? (state.teamScores[String(right.teamNumber)] ?? 0) - (state.teamScores[String(left.teamNumber)] ?? 0) : 0)
      ||
      right.score - left.score
      || right.correctAnswers - left.correctAnswers
      || left.joinedAt.localeCompare(right.joinedAt)
    ));
    let currentRank = 1;
    const ranked = sortedPlayers.map((player, index) => {
      const previous = sortedPlayers[index - 1];
      const rankingChanged = state.gameMode.playMode === "TEAM"
        ? (state.teamScores[String(player.teamNumber)] ?? 0) !== (state.teamScores[String(previous?.teamNumber)] ?? 0)
        : player.score !== previous?.score || player.correctAnswers !== previous?.correctAnswers;
      if (index > 0 && rankingChanged) currentRank = index + 1;
      return { player, rank: currentRank };
    });
    const statements = [
      this.environment.DB.prepare("UPDATE rooms SET status = ?, state_json = ? WHERE id = ?")
        .bind("FINALIZED", JSON.stringify(state), state.roomId),
      this.environment.DB.prepare("DELETE FROM room_results WHERE room_id = ?").bind(state.roomId),
      ...ranked.map(({ player, rank }) => this.environment.DB.prepare(
        "INSERT INTO room_results (id, room_id, participant_id, nickname, score, correct_answers, answers_count, rank, is_winner, team_number, team_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        crypto.randomUUID(),
        state.roomId,
        player.id,
        player.nickname,
        player.score,
        player.correctAnswers,
        player.answersCount,
        rank,
        state.winnerIds.includes(player.id) ? 1 : 0,
        player.teamNumber,
        player.teamNumber ? state.teamScores[String(player.teamNumber)] ?? 0 : null,
        state.finishedAt ?? new Date().toISOString(),
      )),
    ];
    await this.environment.DB.batch(statements);
  }

  private async persistQuestionResponses(
    before: GameRoomState,
    answers: Record<string, PendingAnswer>,
    resolvedAt: string,
  ) {
    const questionId = before.activeQuestion?.id;
    if (!questionId) return;
    const definition = this.content.questions.find((question) => question.id === questionId);
    if (!definition) return;
    const deadline = before.questionDeadlineAt ? new Date(before.questionDeadlineAt).getTime() : new Date(resolvedAt).getTime();
    const startedAt = deadline - definition.timeLimitSeconds * 1000;
    const statements = before.expectedResponderIds.map((participantId) => {
      const submission = answers[participantId];
      const correct = submission ? isCorrectAnswer(definition, submission.answer) : false;
      const submittedAt = submission ? new Date(submission.submittedAt).getTime() : new Date(resolvedAt).getTime();
      return this.environment.DB.prepare(
        "INSERT OR REPLACE INTO room_question_responses (id, room_id, question_id, question_sequence, participant_id, question_prompt, question_type, answer_mode, submitted_answer, correct_answer, is_correct, points_awarded, timed_out, response_time_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        `${before.roomId}:${before.questionCursor}:${participantId}`,
        before.roomId,
        definition.id,
        before.questionCursor,
        participantId,
        definition.prompt,
        definition.type,
        definition.answerMode,
        submission?.answer ?? "",
        definition.correctAnswer,
        correct ? 1 : 0,
        correct ? definition.points : 0,
        submission ? 0 : 1,
        Math.max(0, submittedAt - startedAt),
        resolvedAt,
      );
    });
    if (statements.length > 0) await this.environment.DB.batch(statements);
  }

  private async initialize(request: Request) {
    const input = await request.json<CreateRoomInput>();
    if (!this.state) {
      this.content = { questions: input.questions ?? [], cards: input.cards ?? [] };
      await this.ctx.storage.put(CONTENT_KEY, this.content);
      await this.saveState(createRoomState(input));
    }
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

    // 호스트가 재연결되면 (SPA 뷰 전환 등) 대기 중이던 만료 알람을 취소합니다.
    const isHost = this.state?.players.some((player) => player.role === "HOST" && player.id === session.participantId) ?? false;
    if (isHost) {
      await this.ctx.storage.delete(HOST_EXPIRY_ALARM_KEY);
    }

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
      const now = new Date().toISOString();
      let responseAnswers: Record<string, PendingAnswer> | null = null;
      let next: GameRoomState | null = null;
      if (message.type === "START_GAME") {
        next = startGame(current, attachment.participantId, message.expectedVersion, now);
        // 게임이 시작되면 호스트 만료 알람은 무효화합니다.
        await this.ctx.storage.delete(HOST_EXPIRY_ALARM_KEY);
      } else if (message.type === "ROLL_DICE") {
        next = rollDice(current, attachment.participantId, crypto.getRandomValues(new Uint32Array(1))[0] % 6 + 1, message.expectedVersion, now, this.content);
        if (next.phase === "WAITING_FOR_ANSWER") {
          this.pendingAnswers = {};
          await this.ctx.storage.put(PENDING_ANSWERS_KEY, this.pendingAnswers);
        }
      } else if (message.type === "ANSWER_QUESTION") {
        if (message.answer.length > 500) throw new GameRuleError("ANSWER_TOO_LONG", "답안은 500자 이내로 입력하세요.");
        if (current.activeQuestion?.answerMode === "ALL") {
          const deadlinePassed = current.questionDeadlineAt && new Date(now).getTime() >= new Date(current.questionDeadlineAt).getTime();
          if (deadlinePassed) {
            responseAnswers = this.pendingAnswers;
            next = resolveAllAnswers(current, this.content, Object.fromEntries(Object.entries(this.pendingAnswers).map(([id, entry]) => [id, entry.answer])), true, now);
            this.pendingAnswers = {};
          } else {
            const submitted = submitAllAnswer(current, attachment.participantId, message.expectedVersion, now);
            this.pendingAnswers = { ...this.pendingAnswers, [attachment.participantId]: { answer: message.answer, submittedAt: now } };
            if (submitted.submittedPlayerIds.length === submitted.expectedResponderIds.length) {
              responseAnswers = this.pendingAnswers;
              next = resolveAllAnswers(submitted, this.content, Object.fromEntries(Object.entries(this.pendingAnswers).map(([id, entry]) => [id, entry.answer])), false, now);
              this.pendingAnswers = {};
            } else {
              next = submitted;
            }
          }
          await this.ctx.storage.put(PENDING_ANSWERS_KEY, this.pendingAnswers);
        } else {
          next = answerQuestion(current, attachment.participantId, message.answer, this.content, message.expectedVersion, now);
          responseAnswers = next.lastAnswer?.timedOut ? {} : { [attachment.participantId]: { answer: message.answer, submittedAt: now } };
        }
      } else if (message.type === "END_GAME") {
        next = endGame(current, attachment.participantId, message.expectedVersion, now);
      }

      if (!next) throw new GameRuleError("UNKNOWN_MESSAGE", "지원하지 않는 게임 명령입니다.");
      await this.saveState(next, message.actionId);
      if (responseAnswers && next.lastEvent.type === "QUESTION_ANSWERED") {
        this.ctx.waitUntil(this.persistQuestionResponses(current, responseAnswers, now).catch((error) => console.error("Failed to persist question responses", error)));
      }
      await this.reconcileQuestionAlarm(next);
      if (message.type === "START_GAME") {
        this.ctx.waitUntil(
          this.environment.DB.prepare("UPDATE rooms SET status = ? WHERE id = ?")
            .bind("PLAYING", next.roomId)
            .run()
            .catch((error) => console.error("Failed to persist room lifecycle status", error)),
        );
      }
      if (next.status === "FINALIZED") {
        this.ctx.waitUntil(this.persistFinalResults(next).catch((error) => console.error("Failed to persist final room results", error)));
        // 게임이 끝나면 참가 코드를 즉시 만료합니다.
        this.ctx.waitUntil(
          this.environment.DB.prepare("UPDATE rooms SET expires_at = ? WHERE id = ?")
            .bind(now, next.roomId)
            .run()
            .catch((error) => console.error("Failed to expire room after game end", error)),
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

  async alarm() {
    if (!this.state) return;
    // 호스트 연결 끊김 만료 알람이면 방을 즉시 만료하고 종료합니다.
    const expiryMark = await this.ctx.storage.get<string>(HOST_EXPIRY_ALARM_KEY);
    if (expiryMark) {
      await this.ctx.storage.delete(HOST_EXPIRY_ALARM_KEY);
      // 만료 전에 호스트가 다시 연결됐다면 알람을 무시합니다.
      const hasHostSocket = this.ctx.getWebSockets().some((candidate) => {
        const candidateAttachment = candidate.deserializeAttachment() as SocketAttachment | null;
        return candidateAttachment?.participantId === this.state?.players.find((player) => player.role === "HOST")?.id;
      });
      if (hasHostSocket) return;
      const now = new Date().toISOString();
      await this.environment.DB.prepare("UPDATE rooms SET expires_at = ? WHERE id = ?")
        .bind(now, this.state.roomId)
        .run()
        .catch((error) => console.error("Failed to expire room after host disconnect", error));
      return;
    }
    try {
      const before = this.state;
      const now = new Date().toISOString();
      const responseAnswers = this.pendingAnswers;
      const next = before.activeQuestion?.answerMode === "ALL"
        ? resolveAllAnswers(before, this.content, Object.fromEntries(Object.entries(responseAnswers).map(([id, entry]) => [id, entry.answer])), true, now)
        : timeoutQuestion(before, this.content, now);
      if (next === this.state) {
        await this.reconcileQuestionAlarm(this.state);
        return;
      }
      await this.saveState(next);
      this.pendingAnswers = {};
      await this.ctx.storage.put(PENDING_ANSWERS_KEY, this.pendingAnswers);
      await this.persistQuestionResponses(before, responseAnswers, now);
      await this.reconcileQuestionAlarm(next);
      if (next.status === "FINALIZED") await this.persistFinalResults(next);
      this.broadcastState();
    } catch (error) {
      console.error("Failed to resolve question timeout", error);
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

    // 교사(호스트)의 마지막 연결이 끊기고 아직 게임 시작 전이라면,
    // 60초 후 만료 알람을 설정합니다. SPA 뷰 전환에 따른 짧은 재연결은
    // 알람이 취소되어 방이 유지됩니다. 실제로 창을 닫으면 60초 뒤 만료됩니다.
    const host = this.state.players.find((player) => player.role === "HOST");
    if (host && attachment.participantId === host.id && this.state.status === "LOBBY") {
      const hasHostSocket = this.ctx.getWebSockets().some((candidate) => {
        const candidateAttachment = candidate.deserializeAttachment() as SocketAttachment | null;
        return candidateAttachment?.participantId === host.id;
      });
      if (!hasHostSocket) {
        await this.ctx.storage.put(HOST_EXPIRY_ALARM_KEY, new Date().toISOString());
        await this.ctx.storage.setAlarm(new Date(Date.now() + HOST_DISCONNECT_EXPIRY_MS));
      }
    }
  }
}
