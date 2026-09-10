"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientRoomMessage, GameRoomState, ServerRoomMessage } from "../../shared/game-room";

type ConnectionStatus = "idle" | "connecting" | "open" | "reconnecting" | "error";

type RoomSessionResponse = {
  room: { id: string; code: string; status: string };
  participant: { id: string; nickname: string; role: "HOST" | "PLAYER"; teamNumber?: number | null };
  realtime: { ticket: string; websocketPath: string };
};

const ROOM_SESSION_KEY = "boardrun:active-room-session:v1";
const DISMISSED_ROOM_IDS_KEY = "boardrun:dismissed-room-ids:v1";
const MAX_DISMISSED_IDS = 20;

// sessionStorage를 사용해 같은 탭(SPA 뷰 전환) 안에서 방 세션을 유지합니다.
function readStoredJson(key: string): unknown {
  try {
    const stored = window.sessionStorage.getItem(key);
    return stored ? JSON.parse(stored) as unknown : null;
  } catch {
    return null;
  }
}

function readRoomSession(): RoomSessionResponse | null {
  const stored = readStoredJson(ROOM_SESSION_KEY);
  return stored ? stored as RoomSessionResponse : null;
}

function writeRoomSession(session: RoomSessionResponse) {
  try {
    window.sessionStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(session));
  } catch {
    // The live connection still works when browser storage is unavailable.
  }
}

function clearRoomSession() {
  try {
    window.sessionStorage.removeItem(ROOM_SESSION_KEY);
  } catch {
    // Storage is best-effort only.
  }
}

function readDismissedRoomIds(): string[] {
  const parsed = readStoredJson(DISMISSED_ROOM_IDS_KEY) ?? [];
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
}

function markRoomDismissed(roomId: string) {
  try {
    const next = [roomId, ...readDismissedRoomIds().filter((id) => id !== roomId)].slice(0, MAX_DISMISSED_IDS);
    window.sessionStorage.setItem(DISMISSED_ROOM_IDS_KEY, JSON.stringify(next));
  } catch {
    // Storage is best-effort only.
  }
}

function isRoomDismissed(roomId: string) {
  return readDismissedRoomIds().includes(roomId);
}

async function readRoomResponse(response: Response): Promise<RoomSessionResponse> {
  const payload = await response.json() as RoomSessionResponse & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "게임방 요청을 처리하지 못했습니다.");
  return payload;
}

function websocketUrl(path: string) {
  const url = new URL(path, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function useGameRoom() {
  const [roomState, setRoomState] = useState<GameRoomState | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const manualCloseRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
    if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current);
    reconnectTimerRef.current = null;
    heartbeatRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    generationRef.current += 1;
    clearTimers();
    socketRef.current?.close(1000, "Client disconnected");
    socketRef.current = null;
    setStatus("idle");
  }, [clearTimers]);

  const leaveRoom = useCallback((roomId?: string | null) => {
    if (roomId) markRoomDismissed(roomId);
    clearRoomSession();
    manualCloseRef.current = true;
    generationRef.current += 1;
    clearTimers();
    socketRef.current?.close(1000, "Client left room");
    socketRef.current = null;
    setRoomState(null);
    setParticipantId(null);
    setRoomCode(null);
    setError(null);
    setStatus("idle");
  }, [clearTimers]);

  const connect = useCallback((session: RoomSessionResponse) => {
    manualCloseRef.current = true;
    generationRef.current += 1;
    clearTimers();
    socketRef.current?.close(1000, "Switching room");

    const generation = generationRef.current;
    let reconnectAttempts = 0;
    manualCloseRef.current = false;
    setParticipantId(session.participant.id);
    setRoomCode(session.room.code);
    setError(null);
    writeRoomSession(session);

    const openSocket = () => {
      if (generation !== generationRef.current || manualCloseRef.current) return;
      setStatus(reconnectAttempts === 0 ? "connecting" : "reconnecting");
      const socket = new WebSocket(websocketUrl(session.realtime.websocketPath));
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (generation !== generationRef.current) return socket.close();
        reconnectAttempts = 0;
        setStatus("open");
        setError(null);
        socket.send(JSON.stringify({ type: "SYNC" } satisfies ClientRoomMessage));
        heartbeatRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send("ping");
        }, 30_000);
      });

      socket.addEventListener("message", (event) => {
        if (event.data === "pong") return;
        try {
          const message = JSON.parse(String(event.data)) as ServerRoomMessage;
          if (message.type === "ROOM_STATE") {
            setRoomState(message.state);
            setRoomCode(message.state.code);
            setError(null);
          } else {
            setError(message.message);
            if (message.state) setRoomState(message.state);
          }
        } catch {
          setError("게임방에서 해석할 수 없는 메시지를 받았습니다.");
        }
      });

      socket.addEventListener("close", (event) => {
        if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
        if (generation !== generationRef.current || manualCloseRef.current || event.code === 1000) return;
        reconnectAttempts += 1;
        const delay = Math.min(1_000 * 2 ** (reconnectAttempts - 1), 10_000);
        setStatus("reconnecting");
        reconnectTimerRef.current = window.setTimeout(openSocket, delay);
      });

      socket.addEventListener("error", () => {
        setError("실시간 연결이 불안정합니다. 자동으로 다시 연결합니다.");
      });
    };

    openSocket();
  }, [clearTimers]);

  useEffect(() => {
    let cancelled = false;
    const session = readRoomSession();
    if (session && isRoomDismissed(session.room.id)) {
      clearRoomSession();
    } else if (session) {
      window.queueMicrotask(() => {
        if (!cancelled) connect(session);
      });
    }
    return () => { cancelled = true; };
  }, [connect]);

  useEffect(() => disconnect, [disconnect]);

  const createRoom = useCallback(async (gameId: string) => {
    setError(null);
    const response = await fetch("/api/v1/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId }),
    });
    const session = await readRoomResponse(response);
    connect(session);
    return session;
  }, [connect]);

  const joinRoom = useCallback(async (code: string, nickname: string, teamNumber?: number) => {
    setError(null);
    const response = await fetch("/api/v1/rooms/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, nickname, teamNumber }),
    });
    const session = await readRoomResponse(response);
    connect(session);
    return session;
  }, [connect]);

  const send = useCallback((message: ClientRoomMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("게임방 연결을 기다리고 있습니다.");
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const start = useCallback(() => send({
    type: "START_GAME",
    actionId: crypto.randomUUID(),
    expectedVersion: roomState?.version,
  }), [roomState?.version, send]);

  const roll = useCallback(() => send({
    type: "ROLL_DICE",
    actionId: crypto.randomUUID(),
    expectedVersion: roomState?.version,
  }), [roomState?.version, send]);

  const answer = useCallback((submittedAnswer: string) => send({
    type: "ANSWER_QUESTION",
    actionId: crypto.randomUUID(),
    answer: submittedAnswer,
    expectedVersion: roomState?.version,
  }), [roomState?.version, send]);

  const end = useCallback(() => send({
    type: "END_GAME",
    actionId: crypto.randomUUID(),
    expectedVersion: roomState?.version,
  }), [roomState?.version, send]);

  const canRoll = useMemo(() => (
    status === "open"
    && roomState?.status === "PLAYING"
    && roomState.phase === "WAITING_FOR_ROLL"
    && roomState.currentPlayerId === participantId
  ), [participantId, roomState, status]);

  const canAnswer = useMemo(() => (
    status === "open"
    && roomState?.status === "PLAYING"
    && roomState.phase === "WAITING_FOR_ANSWER"
    && (roomState.activeQuestion?.answerMode === "ALL"
      ? Boolean(participantId && roomState.expectedResponderIds.includes(participantId) && !roomState.submittedPlayerIds.includes(participantId))
      : roomState.currentPlayerId === participantId)
  ), [participantId, roomState, status]);

  const canEnd = useMemo(() => (
    status === "open"
    && roomState?.status === "PLAYING"
    && roomState.players.some((player) => player.id === participantId && player.role === "HOST")
  ), [participantId, roomState, status]);

  return {
    roomState,
    participantId,
    roomCode,
    status,
    error,
    canRoll,
    canAnswer,
    canEnd,
    createRoom,
    joinRoom,
    start,
    roll,
    answer,
    end,
    disconnect,
    leaveRoom,
  };
}
