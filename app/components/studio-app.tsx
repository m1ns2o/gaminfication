"use client";

import {
  ArrowLeft,
  BookOpen,
  Check,
  CircleHelp,
  ChevronDown,
  Clock3,
  Coffee,
  Copy,
  Eye,
  FilePlus2,
  Flag,
  Gift,
  Globe2,
  GraduationCap,
  Grid2X2,
  Library,
  Link2,
  LogIn,
  LogOut,
  LockKeyhole,
  Menu,
  Palette,
  Play,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Send,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { toDataURL as qrToDataURL } from "qrcode";
import { FilterDropdown, type FilterOptionGroup } from "./filter-dropdown";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { boardGeometries, boardGeometryIds, defaultTileTypes, skinNames, tileTypeLabels, type BoardGeometryId, type SkinId, type TileType } from "../lib/board";
import { GameBoard, type BoardTileMark } from "./game-board";
import { ContentEditor } from "./content-editor";
import { RoomPrompt } from "./room-prompt";
import { GameSettingsEditor, type EditableGameSettings } from "./game-settings-editor";
import { useGameRoom } from "../lib/use-game-room";
import "../studio.css";

type View = "dashboard" | "library" | "editor" | "room";
type EditorSection = "settings" | "tiles" | "content";
type GameStatus = "DRAFT" | "PUBLISHED" | "PENDING_REVIEW";
type JoinRoomInfo = { gameTitle: string; playMode: "INDIVIDUAL" | "TEAM"; teamCount: number };
type StudioAuth = {
  user: { displayName: string; email: string } | null;
  signInPath: string;
  signOutPath: string;
};

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
  victoryMode?: "AUTO" | "SCORE" | "ROUNDS" | "FINISH";
  targetScore?: number;
  maxRounds?: number;
  tileTypes?: TileType[];
  playMode?: "INDIVIDUAL" | "TEAM";
  teamCount?: number;
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
  victoryMode: "AUTO" | "SCORE" | "ROUNDS" | "FINISH";
  targetScore: number;
  maxRounds: number;
  tileConfigJson: string;
  playMode: "INDIVIDUAL" | "TEAM";
  teamCount: number;
};

// /api/v1/library가 반환하는 공유마당 게임 (발행된 게임 중 일부 필드만)
type LibraryGame = Pick<Game, "id" | "title" | "description" | "subject" | "grade" | "template" | "skin" | "updated" | "questions" | "cards">;

function fromApiGame(game: ApiGame): Game {
  let tileTypes: TileType[] = [...defaultTileTypes];
  try {
    const parsed = JSON.parse(game.tileConfigJson) as TileType[];
    if (parsed.length === 24) tileTypes = parsed;
  } catch {
    // Older games use the default board layout.
  }
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
    victoryMode: game.victoryMode,
    targetScore: game.targetScore,
    maxRounds: game.maxRounds,
    tileTypes,
    playMode: game.playMode,
    teamCount: game.teamCount,
  };
}


const gradeGroups = [
  { stage: "초등", years: 6 },
  { stage: "중등", years: 3 },
  { stage: "고등", years: 3 },
];
const subjectGroups: FilterOptionGroup[] = [
  {
    group: "국어",
    options: [
      { value: "국어", label: "국어" },
      { value: "화법과 작문", label: "화법과 작문" },
      { value: "독서", label: "독서" },
      { value: "문학", label: "문학" },
      { value: "언어와 매체", label: "언어와 매체" },
    ],
  },
  {
    group: "수학",
    options: [
      { value: "수학", label: "수학" },
      { value: "수학Ⅰ", label: "수학Ⅰ" },
      { value: "수학Ⅱ", label: "수학Ⅱ" },
      { value: "확률과 통계", label: "확률과 통계" },
      { value: "미적분", label: "미적분" },
      { value: "기하", label: "기하" },
    ],
  },
  {
    group: "영어",
    options: [
      { value: "영어", label: "영어" },
      { value: "영어Ⅰ", label: "영어Ⅰ" },
      { value: "영어Ⅱ", label: "영어Ⅱ" },
      { value: "영어 독해와 작문", label: "영어 독해와 작문" },
      { value: "영어 회화", label: "영어 회화" },
    ],
  },
  {
    group: "사회",
    options: [
      { value: "사회", label: "사회" },
      { value: "통합사회", label: "통합사회" },
      { value: "한국지리", label: "한국지리" },
      { value: "세계지리", label: "세계지리" },
      { value: "세계사", label: "세계사" },
      { value: "동아시아사", label: "동아시아사" },
      { value: "경제", label: "경제" },
      { value: "정치와 법", label: "정치와 법" },
      { value: "사회·문화", label: "사회·문화" },
      { value: "생활과 윤리", label: "생활과 윤리" },
      { value: "윤리와 사상", label: "윤리와 사상" },
      { value: "한국사", label: "한국사" },
    ],
  },
  {
    group: "과학",
    options: [
      { value: "과학", label: "과학" },
      { value: "통합과학", label: "통합과학" },
      { value: "과학탐구실험", label: "과학탐구실험" },
      { value: "물리학Ⅰ", label: "물리학Ⅰ" },
      { value: "물리학Ⅱ", label: "물리학Ⅱ" },
      { value: "화학Ⅰ", label: "화학Ⅰ" },
      { value: "화학Ⅱ", label: "화학Ⅱ" },
      { value: "생명과학Ⅰ", label: "생명과학Ⅰ" },
      { value: "생명과학Ⅱ", label: "생명과학Ⅱ" },
      { value: "지구과학Ⅰ", label: "지구과학Ⅰ" },
      { value: "지구과학Ⅱ", label: "지구과학Ⅱ" },
    ],
  },
  {
    group: "기타",
    options: [
      { value: "미술", label: "미술" },
      { value: "음악", label: "음악" },
      { value: "체육", label: "체육" },
      { value: "정보", label: "정보" },
      { value: "기술·가정", label: "기술·가정" },
      { value: "미지정", label: "미지정" },
    ],
  },
];

// 학년(학교급)별로 노출할 과목. 초등은 통합 교과, 중등·고등은 선택과목까지.
const subjectsByStage: Record<string, string[]> = {
  초등: ["국어", "수학", "사회", "과학", "영어", "미술", "음악", "체육", "정보", "기술·가정"],
  중등: ["국어", "수학", "영어", "사회", "과학", "미술", "음악", "체육", "정보", "기술·가정"],
  고등: ["국어", "수학", "영어", "한국사", "사회", "과학", "미술", "음악", "체육", "정보", "기술·가정"],
};

function statusText(status: GameStatus) {
  return {
    DRAFT: "초안",
    PUBLISHED: "발행됨",
    PENDING_REVIEW: "심사 중",
  }[status];
}

// 수업 방 참가용 QR 코드 — 스캔하면 참가 페이지(?code=…)로 이동합니다.
function RoomQrCode({ roomCode }: { roomCode: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    const url = `${window.location.origin}/?code=${roomCode}`;
    let cancelled = false;
    void qrToDataURL(url, {
      width: 240,
      margin: 2,
      color: { dark: "#23274f", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((urlValue) => { if (!cancelled) setDataUrl(urlValue); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [roomCode]);

  return (
    <div className="qr-mark" aria-label="방 참가 QR 코드">
      {dataUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element -- QR 코드는 data URL이라 next/image 최적화 불가 */
        <img src={dataUrl} alt={`방 참가 QR 코드 (${roomCode})`} width={240} height={240} />
      ) : (
        <span className="qr-mark__placeholder" aria-hidden="true">QR</span>
      )}
      <p className="qr-mark__hint">스캔하면 바로 입장할 수 있어요</p>
    </div>
  );
}

const tileLegendEntries = [
  { type: "START", label: tileTypeLabels.START, icon: Flag },
  { type: "QUIZ", label: tileTypeLabels.QUIZ, icon: BookOpen },
  { type: "BONUS", label: tileTypeLabels.BONUS, icon: Gift },
  { type: "EVENT", label: tileTypeLabels.EVENT, icon: Zap },
  { type: "REST", label: tileTypeLabels.REST, icon: Coffee },
] as const;

// 칸 구성 요약 칩 — 생성 다이얼로그 미리보기 아래에 배치한다.
function TileLegend({ tileTypes }: { tileTypes: TileType[] }) {
  return (
    <div className="tile-legend" aria-label="칸 구성 요약">
      {tileLegendEntries.map(({ type, label, icon: Icon }) => {
        const count = tileTypes.filter((candidate) => candidate === type).length;
        return (
          <span key={type} className={`tile-legend__chip tile-legend__chip--${type.toLowerCase()}`}>
            <Icon aria-hidden="true" />
            <strong>{count}</strong>
            <small>{label}</small>
          </span>
        );
      })}
    </div>
  );
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
  onDelete,
  deleteBusy,
}: {
  game: Game;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleteBusy: boolean;
}) {
  return (
    <div className={`game-list-item${selected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="game-list-item__select"
        onClick={onSelect}
        aria-pressed={selected}
      >
        <span className={`game-list-item__map map-swatch map-swatch--${game.skin.toLowerCase()}`} aria-hidden="true">
          <Grid2X2 />
        </span>
        <span className="game-list-item__copy">
          <strong>{game.title}</strong>
          {game.subject !== "미지정" || game.grade !== "미지정" ? (
            <span>{game.subject} · {game.grade}</span>
          ) : null}
        </span>
        <span className="game-list-item__meta">
          <span className={`status-dot status-dot--${game.status.toLowerCase()}`} />
          {game.visibility === "PUBLIC" ? <Globe2 aria-hidden="true" /> : game.visibility === "UNLISTED" ? <Link2 aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
        </span>
      </button>
      <button
        type="button"
        className="game-list-item__delete"
        onClick={onDelete}
        disabled={deleteBusy}
        aria-label={`${game.title} 삭제`}
        title="게임 삭제"
      >
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  );
}

type PlayerViewProps = {
  realtime: ReturnType<typeof useGameRoom>;
  gameTitle: string;
};

// 학생(참가자) 전용 화면 — 게임에 필요한 부분만 표시하고 편집·관리 UI는 숨김
function PlayerView({ realtime, gameTitle }: PlayerViewProps) {
  const { roomState, participantId, canRoll, canAnswer, roomCode } = realtime;
  const [boardAnimating, setBoardAnimating] = useState(false);
  const me = roomState?.players.find((player) => player.id === participantId);
  const tokens = roomState?.players.map((player) => ({
    id: player.id,
    label: player.nickname,
    position: player.position,
    symbol: player.symbol,
    active: player.id === roomState.currentPlayerId,
  })) ?? [];
  const currentTurnLabel = roomState?.players.find((player) => player.id === roomState?.currentPlayerId)?.nickname
    ?? (roomState?.status === "FINALIZED" ? "게임 종료" : "대기 중");
  const eventLabel = roomState?.status === "FINALIZED"
    ? "최종 결과를 확인하세요"
    : roomState?.activeQuestion
      ? "퀴즈에 답할 차례"
      : roomState?.activeCard
        ? `카드 · ${roomState.activeCard.title}`
        : roomState?.lastAnswer
          ? roomState.lastAnswer.correct ? `정답 · +${roomState.lastAnswer.pointsAwarded}점` : "정답을 확인해 보세요"
          : roomState?.lastGroupResult
            ? `전원 결과 · ${roomState.lastGroupResult.correctCount}/${roomState.lastGroupResult.totalCount}명 정답`
            : roomState?.status === "LOBBY"
              ? "선생님이 게임을 시작할 때까지 기다려 주세요"
              : "퀴즈와 카드로 학습하기";

  return (
    <main className="player-view">
      <header className="player-view__bar">
        <div className="player-view__bar-left">
          <span className="player-view__logo" aria-hidden="true">C</span>
          <strong>{gameTitle}</strong>
        </div>
        {roomCode && <span className="player-view__code">방 코드 {roomCode.slice(0, 3)} {roomCode.slice(3)}</span>}
        {me && (
          <span className="player-view__me">
            <span className="player-view__me-avatar" aria-hidden="true">{me.symbol}</span>
            <span className="player-view__me-name">{me.nickname}</span>
            <span className="player-view__me-score">{me.score}점</span>
          </span>
        )}
      </header>

      <div className="player-view__layout">
        <div className="player-view__board">
          <GameBoard
            geometryId={roomState?.template ?? "LOOP_24"}
            skinId={roomState?.skin ?? "CAMPUS"}
            tokens={tokens}
            round={roomState?.round ?? 1}
            lastRoll={roomState?.lastRoll ?? 1}
            onRoll={canRoll ? () => realtime.roll() : undefined}
            currentTurnLabel={currentTurnLabel}
            eventLabel={eventLabel}
            tileTypes={roomState?.tileTypes}
            movement={roomState?.lastEvent?.from !== undefined ? {
              key: roomState?.version ?? 0,
              actorId: roomState.lastEvent.actorId,
              from: roomState.lastEvent.from,
              rollTo: roomState.lastEvent.to,
              cardDirection: roomState?.activeCard?.effectType === "MOVE_BACK" ? -1 : 1,
            } : undefined}
            onAnimationStateChange={setBoardAnimating}
          />

          {roomState && roomState.status !== "LOBBY" && !boardAnimating && (
            <div className="play-stage__overlay">
              <RoomPrompt
                key={roomState.activeQuestion?.id ?? roomState.lastEvent.type}
                state={roomState}
                canAnswer={canAnswer}
                onAnswer={realtime.answer}
                viewerId={participantId}
              />
            </div>
          )}
        </div>

        <aside className="player-roster" aria-label="참가자 목록">
          <div className="player-roster__head">
            <span>참가자</span>
            <span>{roomState?.players.length ?? 0}명</span>
          </div>
          <ul className="player-roster__list">
            {roomState?.players.map((player) => (
              <li
                key={player.id}
                className={`player-roster__player${player.id === participantId ? " is-me" : ""}${player.role === "HOST" ? " is-host" : ""}${player.connected ? "" : " is-offline"}`}
              >
                <span className="player-roster__avatar" aria-hidden="true">{player.symbol}</span>
                <span className="player-roster__name">
                  {player.nickname}
                  {player.id === participantId && <em>나</em>}
                  {player.role === "HOST" && <em>교사</em>}
                </span>
                <span className="player-roster__score">{player.score}점</span>
              </li>
            ))}
            {(!roomState || roomState.players.length === 0) && (
              <li className="player-roster__empty">대기 중인 참가자가 없습니다.</li>
            )}
          </ul>
        </aside>
      </div>
    </main>
  );
}

function HeaderNav({
  view,
  onView,
  onCreate,
  onJoin,
  auth,
}: {
  view: View;
  onView: (view: View) => void;
  onCreate: () => void;
  onJoin: () => void;
  auth: StudioAuth;
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
        {auth.user ? (
          <form action={auth.signOutPath} method="post">
            <input type="hidden" name="returnTo" value="/" />
            <button className="profile-button" type="submit" title={`${auth.user.displayName} · 로그아웃`}>
              <span className="profile-button__avatar" aria-hidden="true">{auth.user.displayName.trim().charAt(0) || "교"}</span>
              <span className="profile-button__name">{auth.user.displayName}</span>
              <LogOut aria-hidden="true" />
            </button>
          </form>
        ) : (
          <a className="auth-button" href={auth.signInPath}><LogIn aria-hidden="true" /> 교사용 로그인</a>
        )}
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
          {auth.user ? (
            <form action={auth.signOutPath} method="post"><input type="hidden" name="returnTo" value="/" /><button type="submit">로그아웃</button></form>
          ) : <a href={auth.signInPath}>교사용 로그인</a>}
        </nav>
      )}
    </header>
  );
}

// 로딩 중: 데이터와 무관한 정적 셸(인트로·헤딩·버튼·워크벤치 프레임)은 즉시 렌더하고,
// 데이터 영역(게임 목록·보드)에만 스켈레톤을 채운다.
export function StudioApp({ auth }: { auth: StudioAuth }) {
  const realtime = useGameRoom();
  const [view, setView] = useState<View>("dashboard");
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [persistedGameIds, setPersistedGameIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState("");
  const [geometry, setGeometry] = useState<BoardGeometryId>("LOOP_24");
  const [skin, setSkin] = useState<SkinId>("CAMPUS");
  // 칸 편집 섹션의 라이브 드래프트 — 맵 미리보기와 인스펙터가 공유한다.
  const [tileTypes, setTileTypes] = useState<TileType[]>(() => [...defaultTileTypes]);
  const [selectedTileIndex, setSelectedTileIndex] = useState(1);
  // 문제/카드 섹션에서 맵 위에 표시할 콘텐츠 표식 (문제·카드 지정됨)
  const [tileMarks, setTileMarks] = useState<BoardTileMark[]>([]);
  // 새 게임 만들기 다이얼로그의 첫 스킨 / 참가 다이얼로그의 팀 선택 (커스텀 드롭다운 값)
  const [createSkin, setCreateSkin] = useState<SkinId>("CAMPUS");
  const [createTemplate, setCreateTemplate] = useState<BoardGeometryId>("LOOP_24");
  const [joinTeam, setJoinTeam] = useState("1");
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinRoomInfo, setJoinRoomInfo] = useState<JoinRoomInfo | null>(null);
  const [joinLookupStatus, setJoinLookupStatus] = useState<"idle" | "loading" | "found" | "missing">("idle");
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("전체");
  const [subjectFilter, setSubjectFilter] = useState("전체");
  const [libraryGames, setLibraryGames] = useState<LibraryGame[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [liveMessage, setLiveMessage] = useState("");
  const [editorSection, setEditorSection] = useState<EditorSection>("content");
  const [stepsCollapsed, setStepsCollapsed] = useState(false);
  const [realtimeBusy, setRealtimeBusy] = useState(false);
  const [boardAnimating, setBoardAnimating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const clientIdSequence = useRef(1);

  const selectedGame = games.find((game) => game.id === selectedId) ?? games[0] ?? null;
  // 현재 사용자가 참가자(학생)면 게임 전용 화면으로 전환
  const isPlayer = realtime.roomState?.players.some((player) => player.id === realtime.participantId && player.role === "PLAYER") ?? false;
  const hasLibraryFilter = gradeFilter !== "전체" || subjectFilter !== "전체" || search.trim() !== "";
  const currentTurnLabel = realtime.roomState?.players.find(
    (player) => player.id === realtime.roomState?.currentPlayerId,
  )?.nickname ?? (realtime.roomState?.status === "FINALIZED" ? "게임 종료" : "대기 중");
  const boardEventLabel = realtime.roomState?.status === "FINALIZED"
    ? "최종 결과를 확인하세요"
    : realtime.roomState?.activeQuestion
    ? "퀴즈에 답할 차례"
    : realtime.roomState?.activeCard
      ? `카드 · ${realtime.roomState.activeCard.title}`
      : realtime.roomState?.lastAnswer
        ? realtime.roomState.lastAnswer.correct ? `정답 · +${realtime.roomState.lastAnswer.pointsAwarded}점` : "정답을 확인해 보세요"
        : realtime.roomState?.lastGroupResult
          ? `전원 결과 · ${realtime.roomState.lastGroupResult.correctCount}/${realtime.roomState.lastGroupResult.totalCount}명 정답`
        : "퀴즈와 카드로 학습하기";
  const formattedRoomCode = realtime.roomCode
    ? `${realtime.roomCode.slice(0, 3)} ${realtime.roomCode.slice(3)}`
    : "--- ---";

  // 에디터 우측 맵 레일 — 섹션에 따라 상호작용 대상 칸이 달라진다.
  const editorTileTypes = tileTypes.length === 24 ? tileTypes : [...defaultTileTypes];
  const editorEditMode = editorSection !== "settings";
  const currentEditorStep = editorSection === "settings" ? 1 : 3;

  // 칸 유형을 바꾸면 즉시 저장한다 (칸 편집·콘텐츠 편집이 한 흐름이므로 별도 저장 버튼 불필요).
  async function saveTileTypes(next: TileType[]) {
    if (!selectedGame) return;
    try {
      const response = await fetch(`/api/v1/games/${selectedGame.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tileTypes: next }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "칸 유형을 저장하지 못했습니다.");
      updateTileTypes(next);
    } catch (error) {
      setLiveMessage(error instanceof Error ? error.message : "칸 유형을 저장하지 못했습니다.");
    }
  }

  function handleEditorTileClick(index: number) {
    setSelectedTileIndex(index);
  }

  function handleEditorTileTypeChange(index: number, type: TileType) {
    if (index === 0) return; // 시작 칸은 고정
    const next = editorTileTypes.map((candidate, candidateIndex) => candidateIndex === index ? type : candidate);
    setTileTypes(next);
    void saveTileTypes(next);
  }
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
        setTileTypes(serverGames[0].tileTypes ?? [...defaultTileTypes]);
        setSelectedTileIndex(1);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setGamesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // 공유마당은 서버(/api/v1/library)에서 조회한 발행 게임만 보여줍니다.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/library")
      .then(async (response) => {
        const payload = await response.json() as { games?: LibraryGame[] };
        if (!cancelled) setLibraryGames(payload.games ?? []);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLibraryLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const normalizedCode = joinCode.replace(/\D/g, "");
    if (!joinOpen || normalizedCode.length !== 6) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/v1/rooms/join?code=${normalizedCode}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json() as { room?: JoinRoomInfo };
          if (!response.ok || !payload.room) throw new Error("ROOM_NOT_FOUND");
          setJoinRoomInfo(payload.room);
          setJoinTeam("1");
          setJoinLookupStatus("found");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setJoinRoomInfo(null);
          setJoinLookupStatus("missing");
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [joinCode, joinOpen]);

  const lastRoomEvent = realtime.roomState?.lastEvent;
  const roomEventActor = realtime.roomState?.players.find((player) => player.id === lastRoomEvent?.actorId);
  const announcedMessage = realtime.error
    ?? (lastRoomEvent?.type === "GAME_FINISHED"
      ? "게임이 종료되었습니다. 최종 결과를 확인하세요."
      : lastRoomEvent?.type === "QUESTION_PRESENTED"
      ? `${roomEventActor?.nickname ?? "참가자"}에게 퀴즈가 출제되었습니다.`
      : lastRoomEvent?.type === "QUESTION_ANSWERED"
        ? lastRoomEvent.correct ? `정답입니다. ${lastRoomEvent.pointsAwarded ?? 0}점을 얻었습니다.` : lastRoomEvent.timedOut ? "제한시간이 끝났습니다." : "오답입니다. 정답과 해설을 확인하세요."
        : lastRoomEvent?.type === "CARD_DRAWN" && realtime.roomState?.activeCard
          ? `${realtime.roomState.activeCard.title} 카드가 적용되었습니다.`
          : lastRoomEvent?.type === "DICE_ROLLED" && lastRoomEvent.dice
      ? `주사위 ${lastRoomEvent.dice}. ${roomEventActor?.nickname ?? "참가자"}의 말이 ${lastRoomEvent.dice}칸 이동했습니다.`
      : liveMessage);

  function selectGame(game: Game) {
    setSelectedId(game.id);
    setGeometry(game.template);
    setSkin(game.skin);
    setTileTypes(game.tileTypes ?? [...defaultTileTypes]);
    setSelectedTileIndex(1);
    setLiveMessage(`${game.title} ${statusText(game.status)}을 불러왔습니다.`);
  }

  async function handleDeleteGame() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const response = await fetch(`/api/v1/games/${deleteTarget.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("DELETE_FAILED");
      const remaining = games.filter((game) => game.id !== deleteTarget.id);
      setGames(remaining);
      setPersistedGameIds((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.id);
        return next;
      });
      if (selectedId === deleteTarget.id) {
        const nextSelected = remaining[0] ?? null;
        if (nextSelected) {
          setSelectedId(nextSelected.id);
          setGeometry(nextSelected.template);
          setSkin(nextSelected.skin);
          setTileTypes(nextSelected.tileTypes ?? [...defaultTileTypes]);
          setSelectedTileIndex(1);
        } else {
          setSelectedId("");
        }
      }
      setLiveMessage(`${deleteTarget.title} 게임을 삭제했습니다.`);
      setDeleteTarget(null);
    } catch {
      setLiveMessage("게임을 삭제하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function openCreate() {
    if (!auth.user) {
      window.location.assign(auth.signInPath);
      return;
    }
    setCreateOpen(true);
  }

  function updateContentCounts(questions: number, cards: number) {
    if (!selectedGame) return;
    setGames((current) => current.map((game) => game.id === selectedGame.id ? { ...game, questions, cards } : game));
  }

  function updateGameSettings(saved: EditableGameSettings) {
    setGames((current) => current.map((game) => game.id === saved.id ? { ...game, ...saved, updated: "방금 전" } : game));
    setGeometry(saved.template);
    setSkin(saved.skin);
  }

  function updateTileTypes(tileTypes: TileType[]) {
    if (!selectedGame) return;
    setGames((current) => current.map((game) => game.id === selectedGame.id ? { ...game, tileTypes } : game));
  }

  function resetLibraryFilters() {
    setSearch("");
    setGradeFilter("전체");
    setSubjectFilter("전체");
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

  async function cloneGame(game: LibraryGame) {
    if (!auth.user) {
      window.location.assign(auth.signInPath);
      return;
    }
    if (realtimeBusy || libraryLoading) return;
    setRealtimeBusy(true);
    try {
      const response = await fetch(`/api/v1/games/${game.id}/clone`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const payload = await response.json() as { game?: ApiGame; error?: { message?: string } };
      if (!response.ok || !payload.game) throw new Error(payload.error?.message ?? "게임을 복제하지 못했습니다.");
      const saved = fromApiGame(payload.game);
      setGames((current) => current.some((candidate) => candidate.id === saved.id) ? current : [saved, ...current]);
      setPersistedGameIds((current) => new Set(current).add(saved.id));
      selectGame(saved);
      setView("dashboard");
      setLiveMessage(`${game.title}을 내 비공개 초안으로 복제했습니다.`);
    } catch (error) {
      setLiveMessage(error instanceof Error ? error.message : "게임을 복제하지 못했습니다.");
    } finally {
      setRealtimeBusy(false);
    }
  }

  function copyRoomCode() {
    if (!realtime.roomCode) return;
    navigator.clipboard?.writeText(realtime.roomCode).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  async function prepareRoom() {
    if (realtimeBusy) return;
    if (!auth.user) {
      window.location.assign(auth.signInPath);
      return;
    }
    if (!selectedGame) return;
    setRealtimeBusy(true);
    try {
      const game = await saveGame(selectedGame);
      const session = await realtime.createRoom(game.id);
      setLiveMessage(`참가 코드 ${session.room.code} 방을 만들었습니다.`);
      // 새 방 생성 후 SPA 대기실 화면으로 전환합니다.
      setView("room");
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
      const session = await realtime.joinRoom(String(form.get("code") ?? ""), String(form.get("nickname") ?? ""), joinRoomInfo?.playMode === "TEAM" ? Number(form.get("teamNumber")) : undefined);
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
      {isPlayer && realtime.roomState ? (
        <PlayerView realtime={realtime} gameTitle={realtime.roomState.gameTitle} />
      ) : (
      <>
      <HeaderNav
        view={view}
        onView={setView}
        onCreate={openCreate}
        onJoin={() => { setJoinCode(""); setJoinRoomInfo(null); setJoinLookupStatus("idle"); setJoinOpen(true); }}
        auth={auth}
      />

      <div className="live-region sr-only" aria-live="polite">{announcedMessage}</div>

        {view === "dashboard" && (
          <main className="dashboard-shell">
            <section className="workspace-intro reveal" style={{ "--i": 0 } as React.CSSProperties}>
              <div>
                <p className="workspace-date">{auth.user ? `${auth.user.displayName} 선생님의 게임 테이블` : "교사용 게임 스튜디오 · 로그인하면 게임이 저장됩니다"}</p>
                <h1>오늘의 게임 스테이지</h1>
                <p>보드를 고르고 수업 방을 열면, 학생 기기의 말이 같은 판 위에서 움직입니다.</p>
              </div>
              <div className="workspace-intro__actions">
                <button className="button button--outline" type="button" onClick={() => setJoinOpen(true)}><Users aria-hidden="true" /> 코드 참가</button>
                <button className="button button--primary" type="button" onClick={openCreate}><FilePlus2 aria-hidden="true" /> 새 게임 만들기</button>
              </div>
            </section>

            <aside className="game-library-panel reveal" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="my-games-heading">
              <div className="panel-heading">
                <div>
                  <h2 id="my-games-heading">내 게임</h2>
                  <span key={gamesLoading ? "count-skel" : "count"} className="data-swap">{gamesLoading ? <Skeleton width={30} height={14} /> : `${games.length}개`}</span>
                </div>
                <button className="icon-button" type="button" onClick={openCreate} aria-label="새 게임 만들기"><Plus /></button>
              </div>
                            <div className="game-list">
                {gamesLoading ? (
                  <div className="data-swap" key="list-skel" style={{ display: "grid", gap: "var(--space-xs)" }} aria-hidden="true">
                    {Array.from({ length: 3 }, (_, index) => (
                      <div key={index} style={{ display: "flex", width: "100%", alignItems: "center", gap: "0.75rem", minHeight: "4.25rem" }}>
                        <Skeleton circle width={44} height={44} />
                        <div style={{ minWidth: 0, flex: 1, display: "grid", gap: "0.5rem" }}>
                          <Skeleton width="62%" height={17} />
                          <Skeleton width="44%" height={13} />
                        </div>
                        <Skeleton circle width={20} height={20} />
                      </div>
                    ))}
                  </div>
                ) : games.length === 0 ? (
                  <p className="content-empty__hint">아직 만든 게임이 없습니다. 첫 수업 게임을 만들어 보세요.</p>
                ) : (
                  <div className="data-swap" key="list-ready">
                    {games.map((game) => (
                      <GameListItem key={game.id} game={game} selected={game.id === selectedId} onSelect={() => selectGame(game)} onDelete={() => setDeleteTarget(game)} deleteBusy={deleteBusy && deleteTarget?.id === game.id} />
                    ))}
                  </div>
                )}
              </div>
              <button className="text-button" type="button" onClick={() => setView("library")}><Library aria-hidden="true" /> 공유마당 둘러보기</button>
            </aside>

            <section className="board-workbench reveal" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="selected-game-title">
                            <header className="board-workbench__header">
                <div key={selectedGame ? "hdr-game" : gamesLoading ? "hdr-skel" : "hdr-none"} className="data-swap">
                  {selectedGame ? (
                    <>
                      <div className="status-line">
                        <span className={`status-badge status-badge--${selectedGame.status.toLowerCase()}`}>{statusText(selectedGame.status)}</span>
                        <span>{selectedGame.subject} · {selectedGame.grade}</span>
                      </div>
                      <h2 id="selected-game-title">{selectedGame.title}</h2>
                      <p>{selectedGame.description}</p>
                    </>
                  ) : gamesLoading ? (
                    <div style={{ display: "grid", gap: "0.4rem" }} aria-hidden="true">
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <Skeleton width={64} height={22} borderRadius="999px" />
                        <Skeleton width={90} height={14} />
                      </div>
                      <Skeleton width={260} height={30} borderRadius="0.6rem" />
                      <Skeleton width={220} height={14} />
                    </div>
                  ) : null}
                </div>
                <div className="workbench-actions__buttons data-swap" key={selectedGame ? "btns" : gamesLoading ? "btns-skel" : "btns-none"}>
                  {selectedGame ? (
                    <>
                      <button className="button button--quiet" type="button" onClick={() => setView("editor")}><Settings aria-hidden="true" /> 편집</button>
                      <button className="button button--primary" type="button" onClick={() => void (realtime.roomCode ? setView("room") : prepareRoom())} disabled={realtimeBusy}><Play aria-hidden="true" /> {realtimeBusy ? "준비 중" : realtime.roomCode ? "게임 시작하기" : "방 만들기"}</button>
                    </>
                  ) : gamesLoading ? (
                    <div style={{ display: "flex", gap: "0.75rem" }} aria-hidden="true">
                      <Skeleton width={110} height={44} borderRadius="0.625rem" />
                      <Skeleton width={150} height={44} borderRadius="0.625rem" />
                    </div>
                  ) : null}
                </div>
              </header>

              {selectedGame || gamesLoading ? (
                <div className="board-controls data-swap" aria-label="보드 설정 미리보기" key={selectedGame ? "controls" : "controls-skel"}>
                  {selectedGame ? (
                    <>
                      <div className="segmented-control" role="group" aria-label="맵 템플릿">
                        {boardGeometryIds.map((id) => <button key={id} type="button" aria-pressed={geometry === id} onClick={() => setGeometry(id)}>{boardGeometries[id].shortName}</button>)}
                      </div>
                      <div className="board-display-options">
                        <FilterDropdown
                          label="맵 스킨"
                          icon={Palette}
                          value={skinNames[skin]}
                          onSelect={(value) => {
                            const id = (Object.keys(skinNames) as SkinId[]).find((key) => skinNames[key] === value);
                            if (id) setSkin(id);
                          }}
                          align="end"
                          options={[{ group: "스킨", options: (Object.keys(skinNames) as SkinId[]).map((id) => ({ value: skinNames[id], label: skinNames[id] })) }]}
                        />
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }} aria-hidden="true">
                      <Skeleton width={92} height={44} borderRadius="0.5rem" />
                      <Skeleton width={92} height={44} borderRadius="0.5rem" />
                      <Skeleton width={92} height={44} borderRadius="0.5rem" />
                      <Skeleton width={150} height={44} borderRadius="0.5rem" />
                    </div>
                  )}
                </div>
              ) : null}

              <div className="play-stage">
                {selectedGame ? (
                  <div className="data-swap" key="board-game">
                    <GameBoard
                      geometryId={realtime.roomState?.template ?? geometry}
                      skinId={realtime.roomState?.skin ?? skin}
                      tokens={realtime.roomState ? realtime.roomState.players.map((player) => ({
                        id: player.id,
                        label: player.nickname,
                        position: player.position,
                        symbol: player.symbol,
                        active: player.id === realtime.roomState?.currentPlayerId,
                      })) : []}
                      round={realtime.roomState?.round ?? 1}
                      lastRoll={realtime.roomState?.lastRoll ?? 1}
                      onRoll={realtime.roomState ? realtime.canRoll ? () => realtime.roll() : undefined : undefined}
                      currentTurnLabel={currentTurnLabel}
                      eventLabel={boardEventLabel}
                      tileTypes={realtime.roomState?.tileTypes ?? selectedGame.tileTypes ?? defaultTileTypes}
                      movement={realtime.roomState && lastRoomEvent?.from !== undefined ? {
                        key: realtime.roomState.version,
                        actorId: lastRoomEvent.actorId,
                        from: lastRoomEvent.from,
                        rollTo: lastRoomEvent.to,
                        cardDirection: realtime.roomState.activeCard?.effectType === "MOVE_BACK" ? -1 : 1,
                      } : undefined}
                      onAnimationStateChange={setBoardAnimating}
                    />
                    {realtime.roomState && realtime.roomState.status !== "LOBBY" && !boardAnimating && (
                      <div className="play-stage__overlay">
                        <RoomPrompt
                          key={realtime.roomState.activeQuestion?.id ?? realtime.roomState.lastEvent.type}
                          state={realtime.roomState}
                          canAnswer={realtime.canAnswer}
                          onAnswer={realtime.answer}
                          viewerId={realtime.participantId}
                        />
                      </div>
                    )}
                  </div>
                ) : gamesLoading ? (
                  <div className="data-swap" key="board-skel" aria-hidden="true">
                    <Skeleton style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: "0.875rem", border: "4px solid var(--color-rule-strong)" }} />
                  </div>
                ) : (
                  <div className="data-swap board-empty">
                    <div className="workspace-empty__mark" aria-hidden="true"><FilePlus2 /></div>
                    <h1>아직 만든 게임이 없습니다</h1>
                    <p>첫 수업 게임을 만들어 보세요. 학생들은 게임 코드로 입장하고, 같은 보드 위에서 움직입니다.</p>
                    <button className="button button--primary" type="button" onClick={openCreate}><FilePlus2 aria-hidden="true" /> 첫 게임 만들기</button>
                  </div>
                )}
              </div>


              <div className="workbench-actions data-swap" key={selectedGame ? "actions" : gamesLoading ? "actions-skel" : "actions-none"}>
                {selectedGame ? (
                  <>
                    <div className="content-counts">
                      <span><CircleHelp aria-hidden="true" /> 퀴즈 {selectedGame.questions}</span>
                      <span><Sparkles aria-hidden="true" /> 이벤트 카드 {selectedGame.cards}</span>
                      <span><Clock3 aria-hidden="true" /> 최근 수정 {selectedGame.updated}</span>
                    </div>
                    {realtime.canEnd && <button className="button button--danger" type="button" onClick={() => realtime.end()}>게임 종료</button>}
                  </>
                ) : gamesLoading ? (
                  <Skeleton width={200} height={16} />
                ) : null}
              </div>

            </section>
          </main>
        )}

      {view === "room" && (
        <main className="room-lounge" aria-labelledby="room-lounge-title">
          <header className="room-lounge__bar">
            <button className="icon-button" type="button" onClick={() => setView("dashboard")} aria-label="대시보드로 돌아가기"><ArrowLeft /></button>
            <div>
              <span className="online-dot" aria-hidden="true" />
              <strong>{realtime.roomState?.gameTitle ?? selectedGame?.title ?? "게임 대기실"}</strong>
            </div>
            <span className="room-lounge__status">{realtime.status === "open" ? "실시간 연결됨" : realtime.status === "reconnecting" ? "재연결 중" : "연결 준비 중"}</span>
          </header>
          <div className="room-lounge__body">
            <section className="room-lounge__invite" aria-labelledby="room-invite-title">
              <h2 id="room-invite-title">학생들을 초대하세요</h2>
              <p>QR을 스캔하거나 참가 코드를 알려주면 학생들이 바로 입장합니다.</p>
              <RoomQrCode roomCode={realtime.roomCode ?? ""} />
              <div className="room-code-copy">
                <span>참가 코드</span>
                <strong>{formattedRoomCode}</strong>
                <button className="button button--outline copy-button" data-state={copied ? "copied" : undefined} type="button" onClick={copyRoomCode}>{copied ? <Check /> : <Copy />}{copied ? "복사됨" : "코드 복사"}</button>
              </div>
              <p className="room-lounge__expiry">이 방은 <strong>2시간</strong> 동안 열려 있습니다. 대시보드로 돌아가거나 게임을 시작하면 참가 코드가 만료됩니다.</p>
            </section>
            <section className="room-lounge__roster" aria-labelledby="room-roster-title">
              <div className="room-lounge__roster-head">
                <div>
                  <h2 id="room-roster-title">접속한 학생</h2>
                  <span>총 {realtime.roomState?.players.length ?? 0}명 · 접속 {realtime.roomState?.players.filter((player) => player.connected).length ?? 0}명</span>
                </div>
              </div>
              <ul className="room-roster__list">
                {(realtime.roomState?.players ?? []).map((player) => (
                  <li key={player.id} className={`room-roster__player${player.role === "HOST" ? " is-host" : ""}${player.connected ? "" : " is-offline"}`}>
                    <span className="host-roster__dot" aria-hidden="true" />
                    <span>{player.nickname}{player.role === "HOST" ? " (교사)" : ""}</span>
                    <em>{player.connected ? "접속 중" : "연결 끊김"}</em>
                  </li>
                ))}
              </ul>
              {(realtime.roomState?.players.length ?? 0) <= 1 && (
                <p className="room-lounge__empty">아직 학생이 입장하지 않았습니다. QR 또는 참가 코드를 공유해 주세요.</p>
              )}
            </section>
          </div>
          <footer className="room-lounge__footer">
            <span className="room-lounge__hint">모든 학생이 들어오면 게임을 시작할 수 있습니다.</span>
            <button className="button button--ink" type="button" disabled={realtime.status !== "open" || realtime.roomState?.status !== "LOBBY"} onClick={() => { realtime.start(); setLiveMessage("실시간 게임을 시작했습니다."); setView("dashboard"); }}><Play aria-hidden="true" /> 게임 시작</button>
          </footer>
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
            <button className="button button--primary" type="button" onClick={openCreate}><Plus /> 처음부터 만들기</button>
          </header>
          <section className="library-tools" aria-label="공유마당 검색과 필터">
            <label className="search-field">
              <Search aria-hidden="true" />
              <span className="sr-only">게임 검색</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목, 설명으로 검색" />
            </label>
            <div className="library-dropdowns" role="group" aria-label="학년과 과목으로 찾기">
              <FilterDropdown
                label="전체 학년"
                icon={GraduationCap}
                value={gradeFilter}
                onSelect={setGradeFilter}
                options={[
                  { group: "학년", options: [{ value: "전체", label: "전체 학년" }] },
                  ...gradeGroups.map(({ stage, years }) => ({
                    group: stage,
                    options: [
                      { value: `${stage} 전체`, label: `${stage} 전체` },
                      ...Array.from({ length: years }, (_, index) => index + 1).map((year) => ({ value: `${stage} ${year}`, label: `${stage} ${year}학년` })),
                    ],
                  })),
                ]}
              />
              <FilterDropdown
                label="전체 과목"
                icon={BookOpen}
                value={subjectFilter}
                onSelect={setSubjectFilter}
                align="end"
                options={(() => {
                  const stage = gradeFilter === "전체" ? null : gradeFilter.startsWith("초등") ? "초등" : gradeFilter.startsWith("중등") ? "중등" : gradeFilter.startsWith("고등") ? "고등" : null;
                  if (!stage) {
                    return [
                      { group: "과목", options: [{ value: "전체", label: "전체 과목" }] },
                      ...subjectGroups.map((group) => ({ group: group.group, options: group.options })),
                    ];
                  }
                  const stageSubjects = subjectsByStage[stage] ?? [];
                  const groups = subjectGroups
                    .map((group) => ({ ...group, options: group.options.filter((option) => stageSubjects.includes(option.value)) }))
                    .filter((group) => group.options.length > 0);
                  return [
                    { group: "과목", options: [{ value: "전체", label: "전체 과목" }] },
                    ...groups,
                  ];
                })()}
              />
            </div>
            {hasLibraryFilter && (
              <div className="active-filters" aria-label="적용된 필터">
                {gradeFilter !== "전체" && (
                  <button className="active-filters__chip" type="button" onClick={() => setGradeFilter("전체")}>
                    <GraduationCap aria-hidden="true" />
                    {gradeFilter}
                    <X aria-hidden="true" />
                    <span className="sr-only">학년 필터 지우기</span>
                  </button>
                )}
                {subjectFilter !== "전체" && (
                  <button className="active-filters__chip" type="button" onClick={() => setSubjectFilter("전체")}>
                    <BookOpen aria-hidden="true" />
                    {subjectFilter}
                    <X aria-hidden="true" />
                    <span className="sr-only">과목 필터 지우기</span>
                  </button>
                )}
                <button className="text-button active-filters__reset" type="button" onClick={() => { setGradeFilter("전체"); setSubjectFilter("전체"); }}>
                  <RotateCcw aria-hidden="true" /> 필터 초기화
                </button>
              </div>
            )}
          </section>
          <section className="library-results" aria-labelledby="library-results-heading">
            <div className="library-results__head">
              <h2 id="library-results-heading">{hasLibraryFilter ? "검색 결과" : "추천 게임"}</h2>
              <span aria-live="polite">{libraryLoading ? "불러오는 중" : `${libraryGames.length}개 결과`}</span>
            </div>
            {libraryLoading ? (
              <div className="library-grid" role="status" aria-label="공유마당 게임을 불러오는 중">
                <span className="sr-only">공유마당 게임을 불러오는 중입니다.</span>
                {Array.from({ length: 3 }, (_, index) => (
                  <article className="library-card" key={index} aria-hidden="true">
                    <Skeleton height={150} borderRadius="0.875rem" />
                    <div className="library-card__body">
                      <Skeleton width={92} height={24} borderRadius="999px" />
                      <Skeleton width={160} height={22} />
                      <Skeleton width={220} height={14} />
                    </div>
                  </article>
                ))}
              </div>
            ) : libraryGames.length === 0 ? (
              <div className="library-empty">
                <SearchX aria-hidden="true" />
                <strong>아직 공개된 게임이 없어요</strong>
                <p>내 게임을 발행하면 이곳에 소개됩니다.</p>
                <button className="button button--quiet" type="button" onClick={resetLibraryFilters}><RotateCcw aria-hidden="true" /> 필터 초기화</button>
              </div>
            ) : (
            <div className="library-grid">
              {libraryGames.map((game, index) => (
                <article className={`library-card library-card--${index % 3}`} key={game.id}>
                  <div className={`library-card__preview library-card__preview--${game.skin.toLowerCase()}`}>
                    <GameBoard geometryId={game.template} skinId={game.skin} tokens={[]} round={1} lastRoll={1} compact />
                  </div>
                  <div className="library-card__body">
                    <div className="tag-row"><span>{game.subject}</span><span>{game.grade}</span><span>{boardGeometries[game.template].shortName}</span></div>
                    <h3>{game.title}</h3>
                    <p>{game.description}</p>
                    <div className="library-card__meta"><span>문제 {game.questions}</span><span>카드 {game.cards}</span><span>선생님</span></div>
                  </div>
                  <div className="library-card__actions">
                    <button className="button button--quiet" type="button"><Eye /> 미리보기</button>
                    <button className="button button--ink" type="button" onClick={() => cloneGame(game)}><Copy /> 복제</button>
                  </div>
                </article>
              ))}
            </div>
            )}
          </section>
        </main>
      )}

      {view === "editor" && selectedGame && (
        <main className="editor-page">
          <header className="editor-header">
            <button className="icon-button" type="button" onClick={() => setView("dashboard")} aria-label="대시보드로 돌아가기"><ArrowLeft /></button>
            <div><span>비공개 초안</span><h1>{selectedGame.title}</h1></div>
            <div className="editor-header__actions">
              <span className="save-state"><Check aria-hidden="true" /> 저장됨</span>
              <button className="button button--quiet" type="button" onClick={() => setEditorSection("content")}><Grid2X2 aria-hidden="true" /> 문제·카드</button>
              <button className="button button--primary" type="button" onClick={() => void prepareRoom()} disabled={realtimeBusy}><Send /> {realtimeBusy ? "준비 중" : "발행 준비"}</button>
            </div>
          </header>
          <div className="editor-layout">
            <aside className={`editor-steps reveal${stepsCollapsed ? " is-collapsed" : ""}`} style={{ "--i": 0 } as React.CSSProperties} aria-label="게임 제작 단계">
              <div className="editor-steps__head">
                <h2>제작 단계</h2>
                <span className="editor-steps__count">{currentEditorStep}/5</span>
                <button className="editor-steps__toggle" type="button" onClick={() => setStepsCollapsed((current) => !current)} aria-expanded={!stepsCollapsed} aria-label={stepsCollapsed ? "제작 단계 펼치기" : "제작 단계 접기"}><ChevronDown aria-hidden="true" /></button>
              </div>
              {[
                ["기본 설정", Check], ["맵 템플릿", Check], ["문제·카드", BookOpen], ["테스트 플레이", Play], ["발행", Share2],
              ].map(([label, Icon], index) => {
                const stepNumber = index + 1;
                const StepIcon = Icon as typeof Check;
                const isCurrent = stepNumber === currentEditorStep;
                const isComplete = index < 2 && !isCurrent;
                return <button key={String(label)} type="button" className={`${isCurrent ? "is-current" : ""}${isComplete ? " is-complete" : ""}${index >= 3 ? " is-future" : ""}`} onClick={() => { if (index === 0 || index === 1) setEditorSection("settings"); else if (index === 2) setEditorSection("content"); else setLiveMessage(`${String(label)} 편집 단계는 다음 구현에서 연결됩니다.`); }}><span className="step-number" aria-hidden="true">{isComplete ? <Check /> : stepNumber}</span><StepIcon aria-hidden="true" /><span>{String(label)}</span></button>;
              })}
            </aside>
            <section className="editor-content reveal" style={{ "--i": 1 } as React.CSSProperties} aria-label="편집 내용">
              {editorSection === "settings" ? (
                <GameSettingsEditor
                  key={selectedGame.id}
                  game={{
                    id: selectedGame.id,
                    title: selectedGame.title,
                    description: selectedGame.description,
                    subject: selectedGame.subject,
                    grade: selectedGame.grade,
                    template: selectedGame.template,
                    skin: selectedGame.skin,
                    victoryMode: selectedGame.victoryMode ?? "AUTO",
                    targetScore: selectedGame.targetScore ?? 100,
                    maxRounds: selectedGame.maxRounds ?? 10,
                    playMode: selectedGame.playMode ?? "INDIVIDUAL",
                    teamCount: selectedGame.teamCount ?? 2,
                  }}
                  onSaved={updateGameSettings}
                  onMessage={setLiveMessage}
                />
              ) : (
                <ContentEditor
                  gameId={selectedGame.id}
                  enabled={persistedGameIds.has(selectedGame.id)}
                  tileTypes={editorTileTypes}
                  selectedTileIndex={selectedTileIndex}
                  onSelectTile={setSelectedTileIndex}
                  onTileTypeChange={handleEditorTileTypeChange}
                  onMessage={setLiveMessage}
                  onCountsChange={updateContentCounts}
                  onMarksChange={setTileMarks}
                />
              )}
            </section>
            <aside className="editor-board reveal" style={{ "--i": 2 } as React.CSSProperties} aria-label="맵 미리보기">
              <div className="editor-board__head">
                <h2>{editorSection === "content" ? "문제·카드 — 맵에서 칸을 선택하세요" : "맵 미리보기"}</h2>
                <span className="editor-board__skin"><Palette aria-hidden="true" /> {skinNames[skin]}</span>
              </div>
              <GameBoard
                geometryId={geometry}
                skinId={skin}
                tokens={[]}
                round={1}
                lastRoll={1}
                tileTypes={editorTileTypes}
                compact={editorSection === "settings"}
                editMode={editorEditMode}
                selectedTileIndex={editorEditMode ? selectedTileIndex : null}
                onTileClick={editorEditMode ? handleEditorTileClick : undefined}
                tileMarks={tileMarks}
              />
              <p className="editor-board__hint">
                {editorSection === "content"
                  ? "칸을 누르면 유형과 문제·카드를 함께 편집합니다. 유형 변경은 자동 저장돼요."
                  : "지정한 칸에서 문제와 카드가 출제됩니다."}
              </p>
            </aside>
          </div>
        </main>
      )}

      {/* <footer className="foot-marquee" aria-label="서비스 상태">
        <div className="foot-marquee__track" aria-hidden="true">
          <span>MAKE THE LESSON MOVE · 24 TILES · ONE CLASS · </span>
          <span>MAKE THE LESSON MOVE · 24 TILES · ONE CLASS · </span>
        </div>
        <p className="sr-only">Classloop · 수업을 움직이는 24칸 보드게임 스튜디오</p>
      </footer> */}

      <DialogShell open={createOpen} onClose={() => setCreateOpen(false)} labelledBy="create-dialog-title" className="create-dialog">
        <div className="dialog-heading"><div><span className="dialog-mark"><FilePlus2 /></span><h2 id="create-dialog-title">새 게임 만들기</h2><p>보드 미리보기를 보고 제목과 첫 스킨을 골라 주세요. 모든 설정은 나중에 바꿀 수 있습니다.</p></div><button className="icon-button" type="button" onClick={() => setCreateOpen(false)} aria-label="닫기"><X /></button></div>
        <div className="create-dialog__grid">
          <form className="create-form" onSubmit={createGame}>
            <label><span>게임 제목</span><input name="title" required placeholder="예: 별자리 관찰 여행" /></label>
            <fieldset><legend>맵 템플릿</legend>{boardGeometryIds.map((id) => <label className="radio-card" key={id}><input type="radio" name="template" value={id} checked={createTemplate === id} onChange={() => setCreateTemplate(id)} /><span><Grid2X2 /><strong>{boardGeometries[id].name}</strong><small>{boardGeometries[id].description}</small></span></label>)}</fieldset>
            <label><span>첫 스킨</span><input type="hidden" name="skin" value={createSkin} /><FilterDropdown label="스킨 선택" icon={Palette} value={skinNames[createSkin]} onSelect={(label) => { const id = (Object.keys(skinNames) as SkinId[]).find((key) => skinNames[key] === label); if (id) setCreateSkin(id); }} options={[{ group: "스킨", options: (Object.keys(skinNames) as SkinId[]).map((id) => ({ value: skinNames[id], label: skinNames[id] })) }]} /></label>
            <div className="dialog-actions"><button className="button button--quiet" type="button" onClick={() => setCreateOpen(false)}>취소</button><button className="button button--primary" type="submit">초안 만들기</button></div>
          </form>
          <aside className="create-preview" aria-label="만들게 될 보드 미리보기">
            <GameBoard geometryId={createTemplate} skinId={createSkin} tokens={[]} round={1} lastRoll={1} compact />
            <div className="create-preview__meta"><span className="mono-label">LOOP_24 · 24 TILES</span><strong>{boardGeometries[createTemplate].name}</strong><small>중앙 무대를 둘러 도는 수업형 보드 · 기본 카드 풀 6장 포함</small></div>
            <TileLegend tileTypes={defaultTileTypes} />
          </aside>
        </div>
      </DialogShell>

      <DialogShell open={deleteTarget !== null} onClose={() => { if (!deleteBusy) setDeleteTarget(null); }} labelledBy="delete-dialog-title">
        <div className="dialog-heading"><div><span className="dialog-mark dialog-mark--danger"><Trash2 /></span><h2 id="delete-dialog-title">게임 삭제</h2><p>삭제하면 되돌릴 수 없습니다.</p></div><button className="icon-button" type="button" onClick={() => { if (!deleteBusy) setDeleteTarget(null); }} aria-label="닫기"><X /></button></div>
        <p className="dialog-copy">‘{deleteTarget?.title}’ 게임을 정말 삭제할까요? 문제와 카드, 저장된 세부 설정이 모두 함께 삭제됩니다.</p>
        <div className="dialog-actions"><button className="button button--quiet" type="button" disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>취소</button><button className="button button--danger" type="button" disabled={deleteBusy} onClick={() => void handleDeleteGame()}>{deleteBusy ? "삭제 중…" : "삭제"}</button></div>
      </DialogShell>

      <DialogShell open={joinOpen} onClose={() => setJoinOpen(false)} labelledBy="join-dialog-title" className="join-dialog">
        <div className="dialog-heading"><div><span className="dialog-mark dialog-mark--amber"><Users /></span><h2 id="join-dialog-title">수업 게임 참가</h2><p>선생님 화면에 나온 코드와 사용할 닉네임을 입력하세요.</p></div><button className="icon-button" type="button" onClick={() => setJoinOpen(false)} aria-label="닫기"><X /></button></div>
        <form className="join-form" onSubmit={joinRoom}>
          <label><span>6자리 참가 코드</span><input className="code-input" inputMode="numeric" name="code" pattern="[0-9]{6}" maxLength={6} placeholder="482731" required aria-describedby="code-help" value={joinCode} onChange={(event) => { const nextCode = event.target.value.replace(/\D/g, ""); setJoinCode(nextCode); setJoinRoomInfo(null); setJoinLookupStatus(nextCode.length === 6 ? "loading" : "idle"); }} /><small id="code-help">{joinLookupStatus === "loading" ? "방 정보를 확인하고 있습니다." : joinLookupStatus === "found" && joinRoomInfo ? `${joinRoomInfo.gameTitle} · ${joinRoomInfo.playMode === "TEAM" ? `${joinRoomInfo.teamCount}팀 팀전` : "개인전"}` : joinLookupStatus === "missing" ? "열려 있는 방을 찾지 못했습니다." : "숫자만 6자리 입력하세요."}</small></label>
          <label><span>닉네임</span><input name="nickname" minLength={2} maxLength={12} placeholder="별빛나침반" required /></label>
          {joinRoomInfo?.playMode === "TEAM" && <label><span>팀 선택</span><input type="hidden" name="teamNumber" value={joinTeam} /><FilterDropdown label="팀 선택" icon={Users} value={`${joinTeam}팀`} onSelect={(label) => { const n = Number(String(label).replace(/팀$/, "")); if (Number.isFinite(n)) setJoinTeam(String(n)); }} options={[{ group: "팀", options: Array.from({ length: joinRoomInfo.teamCount }, (_, index) => ({ value: `${index + 1}팀`, label: `${index + 1}팀` })) }]} /></label>}
          <button className="button button--primary button--full" type="submit" disabled={realtimeBusy || joinLookupStatus !== "found"}>{realtimeBusy ? "연결 중" : "게임에 참가하기"}</button>
        </form>
        <p className="privacy-note"><LockKeyhole /> 계정 없이 참가하며, 닉네임은 이 수업이 끝나면 삭제됩니다.</p>
      </DialogShell>
      </>
      )}
    </div>
  );
}
