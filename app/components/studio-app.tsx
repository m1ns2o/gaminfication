"use client";

import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  Eye,
  FilePlus2,
  Gamepad2,
  Globe2,
  Grid2X2,
  Library,
  Link2,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Palette,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { GameBoard } from "./game-board";
import { ContentEditor } from "./content-editor";
import { RoomPrompt } from "./room-prompt";
import { skinNames, type BoardGeometryId, type SkinId } from "../lib/board";
import { useGameRoom } from "../lib/use-game-room";

type View = "dashboard" | "library" | "editor";
type EditorSection = "questions" | "cards";
type GameStatus = "DRAFT" | "PUBLISHED" | "PENDING_REVIEW";

type Game = {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade: string;
  template: BoardGeometryId;
  skin: SkinId;
  status: GameStatus;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  updated: string;
  questions: number;
  cards: number;
};

type ApiGame = {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade: string;
  template: BoardGeometryId;
  skin: SkinId;
  status: GameStatus;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  updatedAt: string;
  questionsCount: number;
  cardsCount: number;
};

function fromApiGame(game: ApiGame): Game {
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    subject: game.subject,
    grade: game.grade,
    template: game.template,
    skin: game.skin,
    status: game.status,
    visibility: game.visibility,
    updated: new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(game.updatedAt)),
    questions: game.questionsCount,
    cards: game.cardsCount,
  };
}

const initialGames: Game[] = [
  {
    id: "game-history-01",
    title: "조선 후기, 변화의 길",
    description: "영조와 정조부터 개항 전까지 핵심 흐름을 복습합니다.",
    subject: "사회",
    grade: "초등 6",
    template: "LOOP_24",
    skin: "CAMPUS",
    status: "DRAFT",
    visibility: "PRIVATE",
    updated: "오늘 16:42",
    questions: 18,
    cards: 8,
  },
  {
    id: "game-science-02",
    title: "태양계 탐사 작전",
    description: "행성과 위성의 특징을 팀전으로 정리하는 수업 게임입니다.",
    subject: "과학",
    grade: "초등 5",
    template: "LOOP_24",
    skin: "SPACE_LAB",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    updated: "8월 26일",
    questions: 24,
    cards: 10,
  },
  {
    id: "game-language-03",
    title: "우리말 문장 구조 레이스",
    description: "문장 성분을 찾으며 결승점까지 이동하는 개인전입니다.",
    subject: "국어",
    grade: "중등 1",
    template: "RACE_24",
    skin: "ECO_EXPEDITION",
    status: "PENDING_REVIEW",
    visibility: "PUBLIC",
    updated: "8월 24일",
    questions: 20,
    cards: 6,
  },
];

const libraryGames: Game[] = [
  {
    id: "lib-math-01",
    title: "분수 왕국의 수상한 지도",
    description: "분수의 크기 비교와 덧셈을 24칸 순환형 보드에서 연습합니다.",
    subject: "수학",
    grade: "초등 4",
    template: "LOOP_24",
    skin: "CAMPUS",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    updated: "8월 27일",
    questions: 22,
    cards: 8,
  },
  {
    id: "lib-science-02",
    title: "생태계 연결 고리",
    description: "먹이 사슬과 생태계 평형을 팀별 토론으로 풀어갑니다.",
    subject: "과학",
    grade: "초등 6",
    template: "RACE_24",
    skin: "ECO_EXPEDITION",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    updated: "8월 25일",
    questions: 19,
    cards: 12,
  },
  {
    id: "lib-english-03",
    title: "Daily English Mission",
    description: "교실 표현과 일상 회화를 빠르게 확인하는 전원 동시 퀴즈입니다.",
    subject: "영어",
    grade: "중등 1",
    template: "LOOP_24",
    skin: "SPACE_LAB",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    updated: "8월 22일",
    questions: 24,
    cards: 9,
  },
];

const sampleTokens = [
  { id: "t1", label: "김하늘 팀", position: 8, symbol: "book" as const, active: true },
  { id: "t2", label: "박지우 팀", position: 5, symbol: "bulb" as const },
  { id: "t3", label: "이서준 팀", position: 5, symbol: "compass" as const },
  { id: "t4", label: "최다은 팀", position: 5, symbol: "leaf" as const },
  { id: "t5", label: "정민호 팀", position: 5, symbol: "rocket" as const },
  { id: "t6", label: "오예린 팀", position: 5, symbol: "book" as const },
];

function statusText(status: GameStatus) {
  return {
    DRAFT: "초안",
    PUBLISHED: "발행됨",
    PENDING_REVIEW: "심사 중",
  }[status];
}

function DialogShell({
  open,
  onClose,
  labelledBy,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`app-dialog ${className}`}
      aria-labelledby={labelledBy}
      onClose={onClose}
    >
      <div className="app-dialog__surface">{children}</div>
    </dialog>
  );
}

function GameListItem({
  game,
  selected,
  onSelect,
}: {
  game: Game;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`game-list-item${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={`game-list-item__map map-swatch map-swatch--${game.skin.toLowerCase()}`} aria-hidden="true">
        <Grid2X2 />
      </span>
      <span className="game-list-item__copy">
        <strong>{game.title}</strong>
        <span>{game.subject} · {game.grade}</span>
      </span>
      <span className="game-list-item__meta">
        <span className={`status-dot status-dot--${game.status.toLowerCase()}`} />
        {game.visibility === "PUBLIC" ? <Globe2 aria-hidden="true" /> : game.visibility === "UNLISTED" ? <Link2 aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
      </span>
    </button>
  );
}

function HeaderNav({
  view,
  onView,
  onCreate,
  onJoin,
}: {
  view: View;
  onView: (view: View) => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="nav-slab">
      <button className="slab-mark" type="button" onClick={() => onView("dashboard")}>
        <span className="slab-mark__glyph" aria-hidden="true">C</span>
        <span>CLASSLOOP</span>
      </button>
      <nav className="slab-nav" aria-label="주요 메뉴">
        <button type="button" aria-current={view === "dashboard" ? "page" : undefined} onClick={() => onView("dashboard")}>내 게임</button>
        <button type="button" aria-current={view === "library" ? "page" : undefined} onClick={() => onView("library")}>공유마당</button>
        <button type="button" onClick={onJoin}>코드로 참가</button>
      </nav>
      <div className="nav-actions">
        <button className="button button--quiet nav-create" type="button" onClick={onCreate}>
          <Plus aria-hidden="true" />
          새 게임
        </button>
        <button className="profile-button" type="button" aria-label="프로필 메뉴 열기">
          <span aria-hidden="true">민</span>
          <ChevronDown aria-hidden="true" />
        </button>
        <button
          className="mobile-menu-button"
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          aria-label="메뉴 열기"
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      {mobileOpen && (
        <nav id="mobile-navigation" className="mobile-navigation" aria-label="모바일 메뉴">
          <button type="button" onClick={() => { onView("dashboard"); setMobileOpen(false); }}>내 게임</button>
          <button type="button" onClick={() => { onView("library"); setMobileOpen(false); }}>공유마당</button>
          <button type="button" onClick={() => { onJoin(); setMobileOpen(false); }}>코드로 참가</button>
          <button type="button" onClick={() => { onCreate(); setMobileOpen(false); }}>새 게임</button>
        </nav>
      )}
    </header>
  );
}

export function StudioApp() {
  const realtime = useGameRoom();
  const [view, setView] = useState<View>("dashboard");
  const [games, setGames] = useState(initialGames);
  const [persistedGameIds, setPersistedGameIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState(initialGames[0].id);
  const [geometry, setGeometry] = useState<BoardGeometryId>(initialGames[0].template);
  const [skin, setSkin] = useState<SkinId>(initialGames[0].skin);
  const [tokens, setTokens] = useState(sampleTokens);
  const [lastRoll, setLastRoll] = useState(4);
  const [round, setRound] = useState(3);
  const [createOpen, setCreateOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("전체");
  const [liveMessage, setLiveMessage] = useState("조선 후기, 변화의 길 초안을 불러왔습니다.");
  const [editorSection, setEditorSection] = useState<EditorSection>("questions");
  const [realtimeBusy, setRealtimeBusy] = useState(false);
  const clientIdSequence = useRef(1);

  const selectedGame = games.find((game) => game.id === selectedId) ?? games[0];
  const filteredLibrary = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return libraryGames.filter((game) => {
      const matchesKeyword = !keyword || `${game.title} ${game.description} ${game.subject} ${game.grade}`.toLowerCase().includes(keyword);
      const matchesFilter = libraryFilter === "전체" || game.subject === libraryFilter;
      return matchesKeyword && matchesFilter;
    });
  }, [search, libraryFilter]);

  const liveTokens = realtime.roomState
    ? realtime.roomState.players.map((player) => ({
        id: player.id,
        label: player.nickname,
        position: player.position,
        symbol: player.symbol,
        active: player.id === realtime.roomState?.currentPlayerId,
      }))
    : tokens;
  const liveGeometry = realtime.roomState?.template ?? geometry;
  const liveSkin = realtime.roomState?.skin ?? skin;
  const liveRound = realtime.roomState?.round ?? round;
  const liveLastRoll = realtime.roomState?.lastRoll ?? lastRoll;
  const currentTurnLabel = realtime.roomState?.players.find(
    (player) => player.id === realtime.roomState?.currentPlayerId,
  )?.nickname ?? "김하늘 팀";
  const boardEventLabel = realtime.roomState?.activeQuestion
    ? "퀴즈에 답할 차례"
    : realtime.roomState?.activeCard
      ? `카드 · ${realtime.roomState.activeCard.title}`
      : realtime.roomState?.lastAnswer
        ? realtime.roomState.lastAnswer.correct ? `정답 · +${realtime.roomState.lastAnswer.pointsAwarded}점` : "정답을 확인해 보세요"
        : "퀴즈와 카드로 학습하기";
  const formattedRoomCode = realtime.roomCode
    ? `${realtime.roomCode.slice(0, 3)} ${realtime.roomCode.slice(3)}`
    : "--- ---";

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/me/games")
      .then(async (response) => {
        const payload = await response.json() as { games?: ApiGame[] };
        if (!response.ok || !payload.games?.length || cancelled) return;
        const serverGames = payload.games.map(fromApiGame);
        setGames(serverGames);
        setPersistedGameIds(new Set(serverGames.map((game) => game.id)));
        setSelectedId(serverGames[0].id);
        setGeometry(serverGames[0].template);
        setSkin(serverGames[0].skin);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const lastRoomEvent = realtime.roomState?.lastEvent;
  const roomEventActor = realtime.roomState?.players.find((player) => player.id === lastRoomEvent?.actorId);
  const announcedMessage = realtime.error
    ?? (lastRoomEvent?.type === "QUESTION_PRESENTED"
      ? `${roomEventActor?.nickname ?? "참가자"}에게 퀴즈가 출제되었습니다.`
      : lastRoomEvent?.type === "QUESTION_ANSWERED"
        ? lastRoomEvent.correct ? `정답입니다. ${lastRoomEvent.pointsAwarded ?? 0}점을 얻었습니다.` : "오답입니다. 정답과 해설을 확인하세요."
        : lastRoomEvent?.type === "CARD_DRAWN" && realtime.roomState?.activeCard
          ? `${realtime.roomState.activeCard.title} 카드가 적용되었습니다.`
          : lastRoomEvent?.type === "DICE_ROLLED" && lastRoomEvent.dice
      ? `주사위 ${lastRoomEvent.dice}. ${roomEventActor?.nickname ?? "참가자"}의 말이 ${lastRoomEvent.dice}칸 이동했습니다.`
      : liveMessage);

  function selectGame(game: Game) {
    setSelectedId(game.id);
    setGeometry(game.template);
    setSkin(game.skin);
    setLiveMessage(`${game.title} ${statusText(game.status)}을 불러왔습니다.`);
  }

  function updateContentCounts(questions: number, cards: number) {
    setGames((current) => current.map((game) => game.id === selectedGame.id ? { ...game, questions, cards } : game));
  }

  function rollDice() {
    if (realtime.roomState) {
      realtime.roll();
      return;
    }
    const roll = Math.floor(Math.random() * 6) + 1;
    setLastRoll(roll);
    setTokens((current) => current.map((token) => token.active ? { ...token, position: (token.position + roll) % 24 } : token));
    setRound((current) => current + (roll === 6 ? 1 : 0));
    setLiveMessage(`주사위 ${roll}. 김하늘 팀의 말이 ${roll}칸 이동했습니다.`);
  }

  async function saveGame(game: Game) {
    if (persistedGameIds.has(game.id)) return game;
    const response = await fetch("/api/v1/me/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: game.title,
        description: game.description,
        subject: game.subject,
        grade: game.grade,
        template: game.template,
        skin: game.skin,
      }),
    });
    const payload = await response.json() as { game?: ApiGame; error?: { message?: string } };
    if (!response.ok || !payload.game) throw new Error(payload.error?.message ?? "게임을 저장하지 못했습니다.");
    const saved = fromApiGame(payload.game);
    setGames((current) => current.map((candidate) => candidate.id === game.id ? saved : candidate));
    setPersistedGameIds((current) => new Set(current).add(saved.id));
    setSelectedId(saved.id);
    return saved;
  }

  async function createGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "새 수업 게임").trim() || "새 수업 게임";
    const template = String(form.get("template")) as BoardGeometryId;
    const nextSkin = String(form.get("skin")) as SkinId;
    const clientId = clientIdSequence.current;
    clientIdSequence.current += 1;
    const game: Game = {
      id: `game-client-${clientId}`,
      title,
      description: "기본 설정을 마치고 칸과 문제를 채워 주세요.",
      subject: "미지정",
      grade: "미지정",
      template,
      skin: nextSkin,
      status: "DRAFT",
      visibility: "PRIVATE",
      updated: "방금 전",
      questions: 0,
      cards: 0,
    };
    try {
      const saved = await saveGame(game);
      setGames((current) => current.some((candidate) => candidate.id === saved.id) ? current : [saved, ...current]);
      selectGame(saved);
      setCreateOpen(false);
      setView("editor");
      setLiveMessage(`${title} 비공개 초안을 만들었습니다.`);
    } catch (error) {
      setLiveMessage(error instanceof Error ? error.message : "게임을 만들지 못했습니다.");
    }
  }

  function cloneGame(game: Game) {
    const clientId = clientIdSequence.current;
    clientIdSequence.current += 1;
    const clone = {
      ...game,
      id: `clone-client-${clientId}`,
      title: `${game.title} 복제본`,
      status: "DRAFT" as const,
      visibility: "PRIVATE" as const,
      updated: "방금 전",
    };
    setGames((current) => [clone, ...current]);
    selectGame(clone);
    setView("dashboard");
    setLiveMessage(`${game.title}을 내 비공개 초안으로 복제했습니다.`);
  }

  function copyRoomCode() {
    if (!realtime.roomCode) return;
    navigator.clipboard?.writeText(realtime.roomCode).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  async function prepareRoom() {
    if (realtimeBusy) return;
    setRealtimeBusy(true);
    try {
      const game = await saveGame(selectedGame);
      const session = await realtime.createRoom(game.id);
      setRoomOpen(true);
      setLiveMessage(`참가 코드 ${session.room.code} 방을 만들었습니다.`);
    } catch (error) {
      setLiveMessage(error instanceof Error ? error.message : "수업 방을 만들지 못했습니다.");
    } finally {
      setRealtimeBusy(false);
    }
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (realtimeBusy) return;
    const form = new FormData(event.currentTarget);
    setRealtimeBusy(true);
    try {
      const session = await realtime.joinRoom(String(form.get("code") ?? ""), String(form.get("nickname") ?? ""));
      setJoinOpen(false);
      setView("dashboard");
      setLiveMessage(`${session.participant.nickname} 닉네임으로 방에 참가했습니다.`);
    } catch (error) {
      setLiveMessage(error instanceof Error ? error.message : "게임방에 참가하지 못했습니다.");
    } finally {
      setRealtimeBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <HeaderNav
        view={view}
        onView={setView}
        onCreate={() => setCreateOpen(true)}
        onJoin={() => setJoinOpen(true)}
      />

      <div className="live-region sr-only" aria-live="polite">{announcedMessage}</div>

      {view === "dashboard" && (
        <main className="dashboard-shell">
          <section className="workspace-intro reveal" style={{ "--i": 0 } as React.CSSProperties}>
            <div>
              <p className="workspace-date">2026년 8월 28일 · 금요일 수업</p>
              <h1>수업 게임 작업대</h1>
              <p>초안을 이어서 만들거나, 준비된 게임으로 바로 방을 여세요.</p>
            </div>
            <div className="workspace-intro__actions">
              <button className="button button--outline" type="button" onClick={() => setJoinOpen(true)}>
                <Users aria-hidden="true" /> 코드 참가
              </button>
              <button className="button button--primary" type="button" onClick={() => setCreateOpen(true)}>
                <FilePlus2 aria-hidden="true" /> 새 게임 만들기
              </button>
            </div>
          </section>

          <aside className="game-library-panel reveal" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="my-games-heading">
            <div className="panel-heading">
              <div>
                <h2 id="my-games-heading">내 게임</h2>
                <span>{games.length}개</span>
              </div>
              <button className="icon-button" type="button" onClick={() => setCreateOpen(true)} aria-label="새 게임 만들기"><Plus /></button>
            </div>
            <div className="game-list">
              {games.map((game) => (
                <GameListItem key={game.id} game={game} selected={game.id === selectedId} onSelect={() => selectGame(game)} />
              ))}
            </div>
            <button className="text-button" type="button" onClick={() => setView("library")}>
              <Library aria-hidden="true" /> 공유마당 둘러보기
            </button>
          </aside>

          <section className="board-workbench reveal" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="selected-game-title">
            <header className="board-workbench__header">
              <div>
                <div className="status-line">
                  <span className={`status-badge status-badge--${selectedGame.status.toLowerCase()}`}>{statusText(selectedGame.status)}</span>
                  <span>{selectedGame.subject} · {selectedGame.grade}</span>
                </div>
                <h2 id="selected-game-title">{selectedGame.title}</h2>
                <p>{selectedGame.description}</p>
              </div>
              <button className="icon-button" type="button" aria-label="게임 더보기"><MoreHorizontal /></button>
            </header>

            <div className="board-controls" aria-label="보드 설정 미리보기">
              <div className="segmented-control" role="group" aria-label="맵 템플릿">
                <button type="button" aria-pressed={geometry === "LOOP_24"} onClick={() => setGeometry("LOOP_24")}>순환형</button>
                <button type="button" aria-pressed={geometry === "RACE_24"} onClick={() => setGeometry("RACE_24")}>직선형</button>
              </div>
              <label className="select-label">
                <Palette aria-hidden="true" />
                <span className="sr-only">맵 스킨</span>
                <select value={skin} onChange={(event) => setSkin(event.target.value as SkinId)}>
                  {(Object.keys(skinNames) as SkinId[]).map((id) => <option key={id} value={id}>{skinNames[id]}</option>)}
                </select>
              </label>
            </div>

            <GameBoard
              geometryId={liveGeometry}
              skinId={liveSkin}
              tokens={liveTokens}
              round={liveRound}
              lastRoll={liveLastRoll}
              onRoll={liveGeometry === "LOOP_24" && (!realtime.roomState || realtime.canRoll) ? rollDice : undefined}
              currentTurnLabel={currentTurnLabel}
              eventLabel={boardEventLabel}
            />

            {realtime.roomState?.status === "PLAYING" && (
              <RoomPrompt
                key={realtime.roomState.activeQuestion?.id ?? realtime.roomState.lastEvent.type}
                state={realtime.roomState}
                canAnswer={realtime.canAnswer}
                onAnswer={realtime.answer}
              />
            )}

            <div className="workbench-actions">
              <div className="content-counts">
                <span><CircleHelp aria-hidden="true" /> 문제 {selectedGame.questions}</span>
                <span><Sparkles aria-hidden="true" /> 카드 {selectedGame.cards}</span>
                <span><Clock3 aria-hidden="true" /> 최근 수정 {selectedGame.updated}</span>
              </div>
              <div className="workbench-actions__buttons">
                <button className="button button--quiet" type="button" onClick={() => setView("editor")}><Settings aria-hidden="true" /> 편집</button>
                <button className="button button--primary" type="button" onClick={() => void prepareRoom()} disabled={realtimeBusy}><Play aria-hidden="true" /> {realtimeBusy ? "준비 중" : "방 만들기"}</button>
              </div>
            </div>
          </section>

          <aside className="session-panel reveal" style={{ "--i": 3 } as React.CSSProperties} aria-labelledby="session-heading">
            <div className="panel-heading">
              <div>
                <span className="online-dot" aria-hidden="true" />
                <h2 id="session-heading">오늘의 진행</h2>
              </div>
              <span>실시간</span>
            </div>
            <div className="session-summary">
              <span className="session-summary__time">14:00</span>
              <strong>6학년 2반 사회</strong>
              <span>32명 · 8개 팀</span>
            </div>
            <ol className="session-timeline">
              <li className="is-complete"><Check aria-hidden="true" /><span><strong>참가 확인</strong><small>32명 입장</small></span></li>
              <li className="is-current"><Play aria-hidden="true" /><span><strong>게임 진행</strong><small>3라운드 · 18분</small></span></li>
              <li><BarChart3 aria-hidden="true" /><span><strong>결과 정리</strong><small>종료 후 자동 요약</small></span></li>
            </ol>
            <button className="button button--ink" type="button" onClick={() => realtime.roomCode ? setRoomOpen(true) : void prepareRoom()}>{realtime.roomCode ? "진행 화면 열기" : "수업 방 만들기"}</button>
            <p className="panel-note">서술형 채점 대기 2건 · 재접속 0명</p>
          </aside>
        </main>
      )}

      {view === "library" && (
        <main className="library-page">
          <header className="library-hero">
            <div>
              <span className="library-hero__mark" aria-hidden="true"><Library /></span>
              <h1>선생님들의 수업 게임</h1>
              <p>과목과 학년에 맞는 게임을 찾아 미리 보고, 내 수업용 비공개 초안으로 복제하세요.</p>
            </div>
            <button className="button button--primary" type="button" onClick={() => setCreateOpen(true)}><Plus /> 처음부터 만들기</button>
          </header>
          <section className="library-tools" aria-label="공유마당 검색과 필터">
            <label className="search-field">
              <Search aria-hidden="true" />
              <span className="sr-only">게임 검색</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목, 설명, 과목으로 검색" />
            </label>
            <div className="filter-chips" role="group" aria-label="과목 필터">
              {["전체", "국어", "수학", "사회", "과학", "영어"].map((filter) => (
                <button key={filter} type="button" aria-pressed={libraryFilter === filter} onClick={() => setLibraryFilter(filter)}>{filter}</button>
              ))}
            </div>
          </section>
          <section className="library-results" aria-labelledby="library-results-heading">
            <div className="library-results__head">
              <h2 id="library-results-heading">추천 게임</h2>
              <span aria-live="polite">{filteredLibrary.length}개 결과</span>
            </div>
            <div className="library-grid">
              {filteredLibrary.map((game, index) => (
                <article className={`library-card library-card--${index % 3}`} key={game.id}>
                  <div className={`library-card__preview library-card__preview--${game.skin.toLowerCase()}`}>
                    <GameBoard geometryId={game.template} skinId={game.skin} tokens={[]} round={1} lastRoll={1} compact />
                  </div>
                  <div className="library-card__body">
                    <div className="tag-row"><span>{game.subject}</span><span>{game.grade}</span><span>{game.template === "LOOP_24" ? "순환형" : "직선형"}</span></div>
                    <h3>{game.title}</h3>
                    <p>{game.description}</p>
                    <div className="library-card__meta"><span>문제 {game.questions}</span><span>카드 {game.cards}</span><span>한소연 선생님</span></div>
                  </div>
                  <div className="library-card__actions">
                    <button className="button button--quiet" type="button"><Eye /> 미리보기</button>
                    <button className="button button--ink" type="button" onClick={() => cloneGame(game)}><Copy /> 복제</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      )}

      {view === "editor" && (
        <main className="editor-page">
          <header className="editor-header">
            <button className="icon-button" type="button" onClick={() => setView("dashboard")} aria-label="대시보드로 돌아가기"><ArrowLeft /></button>
            <div><span>비공개 초안</span><h1>{selectedGame.title}</h1></div>
            <div className="editor-header__actions">
              <span className="save-state"><Check aria-hidden="true" /> 저장됨</span>
              <button className="button button--quiet" type="button"><Eye /> 테스트</button>
              <button className="button button--primary" type="button" onClick={() => void prepareRoom()} disabled={realtimeBusy}><Send /> {realtimeBusy ? "준비 중" : "발행 준비"}</button>
            </div>
          </header>
          <div className="editor-layout">
            <aside className="editor-steps" aria-label="게임 제작 단계">
              {[
                ["기본 설정", Check], ["맵 템플릿", Check], ["칸 편집", Check], ["문제은행", BookOpen],
                ["카드 덱", Sparkles], ["테스트 플레이", Play], ["발행", Share2],
              ].map(([label, Icon], index) => {
                const StepIcon = Icon as typeof Check;
                const isCurrent = (index === 3 && editorSection === "questions") || (index === 4 && editorSection === "cards");
                return <button key={String(label)} type="button" className={isCurrent ? "is-current" : index < 3 ? "is-complete" : ""} onClick={() => { if (index === 3) setEditorSection("questions"); else if (index === 4) setEditorSection("cards"); else setLiveMessage(`${String(label)} 편집 단계는 다음 구현에서 연결됩니다.`); }}><StepIcon aria-hidden="true" /><span>{String(label)}</span></button>;
              })}
            </aside>
            <ContentEditor
              gameId={selectedGame.id}
              enabled={persistedGameIds.has(selectedGame.id)}
              section={editorSection}
              onMessage={setLiveMessage}
              onCountsChange={updateContentCounts}
            />
            <aside className="editor-preview" aria-label="보드 미리보기">
              <div><h2>맵 미리보기</h2><span>{skinNames[skin]}</span></div>
              <GameBoard geometryId={geometry} skinId={skin} tokens={tokens.slice(0, 2)} round={1} lastRoll={3} compact />
              <p>문제 {selectedGame.questions}개와 카드 {selectedGame.cards}개가 해당 칸에 순환 배치됩니다.</p>
            </aside>
          </div>
        </main>
      )}

      <footer className="foot-marquee" aria-label="서비스 상태">
        <div className="foot-marquee__track" aria-hidden="true">
          <span>MAKE THE LESSON MOVE · 24 TILES · ONE CLASS · </span>
          <span>MAKE THE LESSON MOVE · 24 TILES · ONE CLASS · </span>
        </div>
        <p className="sr-only">Classloop · 수업을 움직이는 24칸 보드게임 스튜디오</p>
      </footer>

      <DialogShell open={createOpen} onClose={() => setCreateOpen(false)} labelledBy="create-dialog-title">
        <div className="dialog-heading"><div><span className="dialog-mark"><FilePlus2 /></span><h2 id="create-dialog-title">새 게임 만들기</h2><p>기본 설정은 나중에 모두 바꿀 수 있습니다.</p></div><button className="icon-button" type="button" onClick={() => setCreateOpen(false)} aria-label="닫기"><X /></button></div>
        <form className="create-form" onSubmit={createGame}>
          <label><span>게임 제목</span><input name="title" required placeholder="예: 조선 후기, 변화의 길" /></label>
          <fieldset><legend>맵 템플릿</legend><label className="radio-card"><input type="radio" name="template" value="LOOP_24" defaultChecked /><span><Grid2X2 /><strong>24칸 순환형</strong><small>중앙 무대가 있는 7×7 보드</small></span></label><label className="radio-card"><input type="radio" name="template" value="RACE_24" /><span><Gamepad2 /><strong>24칸 직선 레이스</strong><small>시작에서 결승까지 가는 S자 경로</small></span></label></fieldset>
          <label><span>첫 스킨</span><select name="skin" defaultValue="CAMPUS">{(Object.keys(skinNames) as SkinId[]).map((id) => <option key={id} value={id}>{skinNames[id]}</option>)}</select></label>
          <div className="dialog-actions"><button className="button button--quiet" type="button" onClick={() => setCreateOpen(false)}>취소</button><button className="button button--primary" type="submit">초안 만들기</button></div>
        </form>
      </DialogShell>

      <DialogShell open={roomOpen} onClose={() => setRoomOpen(false)} labelledBy="room-dialog-title" className="room-dialog">
        <div className="dialog-heading"><div><span className="dialog-mark dialog-mark--teal"><Play /></span><h2 id="room-dialog-title">수업 방이 준비됐어요</h2><p>{realtime.roomState?.gameTitle ?? selectedGame.title}</p></div><button className="icon-button" type="button" onClick={() => setRoomOpen(false)} aria-label="닫기"><X /></button></div>
        <div className="room-code-layout">
          <div className="qr-mark" aria-label="방 참가 QR 코드 미리보기">{Array.from({ length: 121 }, (_, index) => <i key={index} className={(index * 7 + Math.floor(index / 11) * 3) % 5 < 2 ? "is-dark" : ""} />)}</div>
          <div className="room-code-copy"><span>참가 코드</span><strong>{formattedRoomCode}</strong><button className="button button--outline copy-button" data-state={copied ? "copied" : undefined} type="button" onClick={copyRoomCode} disabled={!realtime.roomCode}>{copied ? <Check /> : <Copy />}{copied ? "복사됨" : "코드 복사"}</button></div>
        </div>
        <div className="room-settings"><span><Users /> {realtime.roomState?.players.length ?? 1}명 접속 · 최대 40명</span><span><Eye /> {realtime.status === "open" ? "실시간 연결됨" : realtime.status === "reconnecting" ? "재연결 중" : "연결 준비 중"}</span></div>
        <div className="dialog-actions"><button className="button button--quiet" type="button" onClick={() => setRoomOpen(false)}>보드 보기</button><button className="button button--ink" type="button" disabled={realtime.status !== "open" || realtime.roomState?.status !== "LOBBY"} onClick={() => { realtime.start(); setRoomOpen(false); setLiveMessage("실시간 게임을 시작했습니다."); }}>진행 시작</button></div>
      </DialogShell>

      <DialogShell open={joinOpen} onClose={() => setJoinOpen(false)} labelledBy="join-dialog-title" className="join-dialog">
        <div className="dialog-heading"><div><span className="dialog-mark dialog-mark--amber"><Users /></span><h2 id="join-dialog-title">수업 게임 참가</h2><p>선생님 화면에 나온 코드와 사용할 닉네임을 입력하세요.</p></div><button className="icon-button" type="button" onClick={() => setJoinOpen(false)} aria-label="닫기"><X /></button></div>
        <form className="join-form" onSubmit={joinRoom}>
          <label><span>6자리 참가 코드</span><input className="code-input" inputMode="numeric" name="code" pattern="[0-9]{6}" maxLength={6} placeholder="482731" required aria-describedby="code-help" /><small id="code-help">숫자만 6자리 입력하세요.</small></label>
          <label><span>닉네임</span><input name="nickname" minLength={2} maxLength={12} placeholder="별빛나침반" required /></label>
          <button className="button button--primary button--full" type="submit" disabled={realtimeBusy}>{realtimeBusy ? "연결 중" : "게임에 참가하기"}</button>
        </form>
        <p className="privacy-note"><LockKeyhole /> 계정 없이 참가하며, 닉네임은 이 수업이 끝나면 삭제됩니다.</p>
      </DialogShell>
    </div>
  );
}
