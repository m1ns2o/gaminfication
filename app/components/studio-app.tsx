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
  GraduationCap,
  Grid2X2,
  Library,
  Link2,
  LogIn,
  LogOut,
  LockKeyhole,
  Menu,
  MoreHorizontal,
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
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { GameBoard, type BoardMovement } from "./game-board";
import { ContentEditor } from "./content-editor";
import { PreviewTileAction, type PreviewArrivalType } from "./preview-tile-action";
import { RoomPrompt } from "./room-prompt";
import { GameSettingsEditor, type EditableGameSettings } from "./game-settings-editor";
import { TileEditor } from "./tile-editor";
import { advanceBoardPosition, boardGeometries, boardGeometryIds, defaultTileTypes, skinNames, type BoardGeometryId, type SkinId, type TileType } from "../lib/board";
import { useGameRoom } from "../lib/use-game-room";

type View = "dashboard" | "library" | "editor";
type EditorSection = "settings" | "tiles" | "questions" | "cards";
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

type FilterOptionGroup = {
  group: string;
  options: { value: string; label: string }[];
};

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

// 학년 필터에서 학교급(초등/중등/고등)을 추출. "전체"면 전체 과목.
function activeStage(gradeFilterValue: string): string | null {
  if (gradeFilterValue === "전체") return null;
  return gradeFilterValue.startsWith("초등") ? "초등" : gradeFilterValue.startsWith("중등") ? "중등" : gradeFilterValue.startsWith("고등") ? "고등" : null;
}

function matchesGradeFilter(grade: string, filter: string) {
  if (filter === "전체") return true;
  if (filter.endsWith(" 전체")) return grade.startsWith(filter.slice(0, -3));
  return grade === filter;
}

type FilterDropdownProps = {
  label: string;
  icon: LucideIcon;
  value: string;
  options: FilterOptionGroup[];
  onSelect: (value: string) => void;
  align?: "start" | "end";
};

function FilterDropdown({ label, icon: Icon, value, options, onSelect, align = "start" }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLButtonElement[]>([]);
  const flatOptions = options.flatMap((group) => group.options);
  const isActive = value !== "전체";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("[data-filter-trigger]")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function moveFocus(direction: 1 | -1) {
    const next = direction === 1 ? activeIndex + 1 : activeIndex - 1;
    const clamped = next < 0 ? flatOptions.length - 1 : next >= flatOptions.length ? 0 : next;
    setActiveIndex(clamped);
    itemsRef.current[clamped]?.focus();
  }

  function select(valueToSelect: string) {
    onSelect(valueToSelect);
    setOpen(false);
    setActiveIndex(-1);
    rootRef.current?.querySelector<HTMLButtonElement>("[data-filter-trigger]")?.focus();
  }

  return (
    <div className={`filter-dropdown${isActive ? " is-active" : ""}`} ref={rootRef}>
      <button
        type="button"
        data-filter-trigger
        className="filter-dropdown__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            moveFocus(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            moveFocus(-1);
          }
        }}
      >
        <Icon aria-hidden="true" />
        <span>{isActive ? value : label}</span>
        <ChevronDown aria-hidden="true" className="filter-dropdown__chevron" />
      </button>
      {open && (
        <div className={`filter-popover filter-popover--${align}`} role="listbox" aria-label={label} ref={listRef}>
          {options.map((group, groupIndex) => (
            <div className="filter-popover__group" key={group.group}>
              <span className="filter-popover__group-label">{group.group}</span>
              {group.options.map((option, optionIndex) => {
                const flatIndex = options.slice(0, groupIndex).reduce((sum, g) => sum + g.options.length, 0) + optionIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={value === option.value}
                    className={`filter-popover__option${value === option.value ? " is-selected" : ""}`}
                    ref={(element) => {
                      itemsRef.current[flatIndex] = element as HTMLButtonElement;
                    }}
                    onClick={() => select(option.value)}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                  >
                    <Check aria-hidden="true" className="filter-popover__check" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

export function StudioApp({ auth }: { auth: StudioAuth }) {
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
  const [joinCode, setJoinCode] = useState("");
  const [joinRoomInfo, setJoinRoomInfo] = useState<JoinRoomInfo | null>(null);
  const [joinLookupStatus, setJoinLookupStatus] = useState<"idle" | "loading" | "found" | "missing">("idle");
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("전체");
  const [subjectFilter, setSubjectFilter] = useState("전체");
  const [liveMessage, setLiveMessage] = useState("조선 후기, 변화의 길 초안을 불러왔습니다.");
  const [editorSection, setEditorSection] = useState<EditorSection>("questions");
  const [realtimeBusy, setRealtimeBusy] = useState(false);
  const [boardAnimating, setBoardAnimating] = useState(false);
  const [previewArrival, setPreviewArrival] = useState<{ id: number; type: PreviewArrivalType } | null>(null);
  const [localMovement, setLocalMovement] = useState<BoardMovement | undefined>(undefined);
  const clientIdSequence = useRef(1);
  const localMovementSequence = useRef(1);

  const selectedGame = games.find((game) => game.id === selectedId) ?? games[0];
  const hasLibraryFilter = gradeFilter !== "전체" || subjectFilter !== "전체" || search.trim() !== "";
  const filteredLibrary = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return libraryGames.filter((game) => {
      const matchesKeyword = !keyword || `${game.title} ${game.description} ${game.subject} ${game.grade}`.toLowerCase().includes(keyword);
      const matchesGrade = matchesGradeFilter(game.grade, gradeFilter);
      const matchesSubject = subjectFilter === "전체" || game.subject === subjectFilter;
      return matchesKeyword && matchesGrade && matchesSubject;
    });
  }, [search, gradeFilter, subjectFilter]);

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
  const liveTileTypes = realtime.roomState?.tileTypes ?? selectedGame.tileTypes ?? defaultTileTypes;
  const liveRound = realtime.roomState?.round ?? round;
  const liveLastRoll = realtime.roomState?.lastRoll ?? lastRoll;
  const localCanRoll = boardGeometries[liveGeometry].wraps || tokens.some((token) => token.active && token.position < 23);
  const currentTurnLabel = realtime.roomState?.players.find(
    (player) => player.id === realtime.roomState?.currentPlayerId,
  )?.nickname ?? (realtime.roomState?.status === "FINALIZED" ? "게임 종료" : "김하늘 팀");
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
  const boardMovement: BoardMovement | undefined = realtime.roomState
    ? lastRoomEvent?.from !== undefined ? {
        key: realtime.roomState.version,
        actorId: lastRoomEvent.actorId,
        from: lastRoomEvent.from,
        rollTo: lastRoomEvent.to,
        cardDirection: realtime.roomState.activeCard?.effectType === "MOVE_BACK" ? -1 : 1,
      }
      : undefined
    : localMovement;
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
    setLiveMessage(`${game.title} ${statusText(game.status)}을 불러왔습니다.`);
  }

  function openCreate() {
    if (!auth.user) {
      window.location.assign(auth.signInPath);
      return;
    }
    setCreateOpen(true);
  }

  function updateContentCounts(questions: number, cards: number) {
    setGames((current) => current.map((game) => game.id === selectedGame.id ? { ...game, questions, cards } : game));
  }

  function updateGameSettings(saved: EditableGameSettings) {
    setGames((current) => current.map((game) => game.id === saved.id ? { ...game, ...saved, updated: "방금 전" } : game));
    setGeometry(saved.template);
    setSkin(saved.skin);
  }

  function updateTileTypes(tileTypes: TileType[]) {
    setGames((current) => current.map((game) => game.id === selectedGame.id ? { ...game, tileTypes } : game));
  }

  function resetLibraryFilters() {
    setSearch("");
    setGradeFilter("전체");
    setSubjectFilter("전체");
  }

  function rollDice() {
    setPreviewArrival(null);
    if (realtime.roomState) {
      realtime.roll();
      return;
    }
    const roll = Math.floor(Math.random() * 6) + 1;
    const activeToken = tokens.find((token) => token.active);
    if (!activeToken) return;
    const destination = advanceBoardPosition(geometry, activeToken.position, roll);
    const movementKey = localMovementSequence.current;
    localMovementSequence.current += 1;
    setLocalMovement({ key: movementKey, actorId: activeToken.id, from: activeToken.position, rollTo: destination });
    setLastRoll(roll);
    setTokens((current) => current.map((token) => token.id === activeToken.id ? { ...token, position: destination } : token));
    if (boardGeometries[geometry].wraps && activeToken.position + roll >= 24) setRound((current) => current + 1);
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
    if (!auth.user) {
      window.location.assign(auth.signInPath);
      return;
    }
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
    if (!auth.user) {
      window.location.assign(auth.signInPath);
      return;
    }
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
              <button className="button button--outline" type="button" onClick={() => setJoinOpen(true)}>
                <Users aria-hidden="true" /> 코드 참가
              </button>
              <button className="button button--primary" type="button" onClick={openCreate}>
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
              <button className="icon-button" type="button" onClick={openCreate} aria-label="새 게임 만들기"><Plus /></button>
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
                {boardGeometryIds.map((id) => <button key={id} type="button" aria-pressed={geometry === id} onClick={() => { setGeometry(id); setPreviewArrival(null); }}>{boardGeometries[id].shortName}</button>)}
              </div>
              <div className="board-display-options">
                <label className="select-label">
                  <Palette aria-hidden="true" />
                  <span className="sr-only">맵 스킨</span>
                  <select value={skin} onChange={(event) => setSkin(event.target.value as SkinId)}>
                    {(Object.keys(skinNames) as SkinId[]).map((id) => <option key={id} value={id}>{skinNames[id]}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="play-stage">
              <GameBoard
                geometryId={liveGeometry}
                skinId={liveSkin}
                tokens={liveTokens}
                round={liveRound}
                lastRoll={liveLastRoll}
                onRoll={realtime.roomState ? realtime.canRoll ? rollDice : undefined : localCanRoll ? rollDice : undefined}
                currentTurnLabel={currentTurnLabel}
                eventLabel={boardEventLabel}
                tileTypes={liveTileTypes}
                movement={boardMovement}
                onAnimationStateChange={setBoardAnimating}
                onMovementComplete={({ position, tileType }) => {
                  if (realtime.roomState) return;
                  const type: PreviewArrivalType = !boardGeometries[liveGeometry].wraps && position === 23 ? "FINISH" : tileType;
                  setPreviewArrival({ id: localMovementSequence.current, type });
                }}
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

              {!realtime.roomState && previewArrival && !boardAnimating ? (
                <div className="play-stage__overlay">
                  <PreviewTileAction
                    key={previewArrival.id}
                    gameId={selectedGame.id}
                    type={previewArrival.type}
                    canLoadContent={persistedGameIds.has(selectedGame.id)}
                    questionCount={selectedGame.questions}
                    cardCount={selectedGame.cards}
                    onEdit={(section) => { setEditorSection(section); setView("editor"); setPreviewArrival(null); }}
                    onDismiss={() => setPreviewArrival(null)}
                  />
                </div>
              ) : null}
            </div>

            <div className="workbench-actions">
              <div className="content-counts">
                <span><CircleHelp aria-hidden="true" /> 퀴즈 {selectedGame.questions}</span>
                <span><Sparkles aria-hidden="true" /> 이벤트 카드 {selectedGame.cards}</span>
                <span><Clock3 aria-hidden="true" /> 최근 수정 {selectedGame.updated}</span>
              </div>
              <div className="workbench-actions__buttons">
                <button className="button button--quiet" type="button" onClick={() => setView("editor")}><Settings aria-hidden="true" /> 편집</button>
                {realtime.canEnd && <button className="button button--danger" type="button" onClick={() => realtime.end()}>게임 종료</button>}
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
              <span className="session-summary__time">{realtime.roomCode ? `${realtime.roomCode.slice(0, 3)} ${realtime.roomCode.slice(3)}` : "수업 전"}</span>
              <strong>{realtime.roomState?.gameTitle ?? selectedGame.title}</strong>
              <span>{realtime.roomState ? `${realtime.roomState.players.length}명 · ${realtime.roomState.gameMode.playMode === "TEAM" ? `${realtime.roomState.gameMode.teamCount}개 팀` : "개인전"}` : "방을 만들면 참가 현황이 표시됩니다."}</span>
            </div>
            <ol className="session-timeline">
              <li className={realtime.roomState ? realtime.roomState.status === "LOBBY" ? "is-current" : "is-complete" : ""}><Check aria-hidden="true" /><span><strong>참가 확인</strong><small>{realtime.roomState ? `${realtime.roomState.players.length}명 입장` : "방 생성 대기"}</small></span></li>
              <li className={realtime.roomState?.status === "PLAYING" ? "is-current" : realtime.roomState?.status === "FINALIZED" ? "is-complete" : ""}><Play aria-hidden="true" /><span><strong>게임 진행</strong><small>{realtime.roomState?.status === "PLAYING" ? `${realtime.roomState.round}라운드 · ${realtime.roomState.phase === "WAITING_FOR_ANSWER" ? "응답 중" : "주사위 대기"}` : "시작 전"}</small></span></li>
              <li className={realtime.roomState?.status === "FINALIZED" ? "is-current" : ""}><BarChart3 aria-hidden="true" /><span><strong>결과 정리</strong><small>{realtime.roomState?.status === "FINALIZED" ? "문항별 결과 저장 완료" : "종료 후 자동 요약"}</small></span></li>
            </ol>
            <button className="button button--ink" type="button" onClick={() => realtime.roomCode ? setRoomOpen(true) : void prepareRoom()}>{realtime.roomCode ? "진행 화면 열기" : "수업 방 만들기"}</button>
            <p className="panel-note">{realtime.roomState ? `접속 ${realtime.roomState.players.filter((player) => player.connected).length}명 · 연결 끊김 ${realtime.roomState.players.filter((player) => !player.connected).length}명` : "실시간 접속 상태는 방 안에서 자동 갱신됩니다."}</p>
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
                  const stage = activeStage(gradeFilter);
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
              <span aria-live="polite">{filteredLibrary.length}개 결과</span>
            </div>
            {filteredLibrary.length === 0 ? (
              <div className="library-empty">
                <SearchX aria-hidden="true" />
                <strong>조건에 맞는 게임이 없어요</strong>
                <p>다른 학년이나 과목을 골라 보거나, 검색어를 바꿔 보세요.</p>
                <button className="button button--quiet" type="button" onClick={resetLibraryFilters}><RotateCcw aria-hidden="true" /> 필터 초기화</button>
              </div>
            ) : (
            <div className="library-grid">
              {filteredLibrary.map((game, index) => (
                <article className={`library-card library-card--${index % 3}`} key={game.id}>
                  <div className={`library-card__preview library-card__preview--${game.skin.toLowerCase()}`}>
                    <GameBoard geometryId={game.template} skinId={game.skin} tokens={[]} round={1} lastRoll={1} compact />
                  </div>
                  <div className="library-card__body">
                    <div className="tag-row"><span>{game.subject}</span><span>{game.grade}</span><span>{boardGeometries[game.template].shortName}</span></div>
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
            )}
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
                const isCurrent = ((index === 0 || index === 1) && editorSection === "settings") || (index === 2 && editorSection === "tiles") || (index === 3 && editorSection === "questions") || (index === 4 && editorSection === "cards");
                return <button key={String(label)} type="button" className={isCurrent ? "is-current" : index < 3 ? "is-complete" : ""} onClick={() => { if (index === 0 || index === 1) setEditorSection("settings"); else if (index === 2) setEditorSection("tiles"); else if (index === 3) setEditorSection("questions"); else if (index === 4) setEditorSection("cards"); else setLiveMessage(`${String(label)} 편집 단계는 다음 구현에서 연결됩니다.`); }}><StepIcon aria-hidden="true" /><span>{String(label)}</span></button>;
              })}
            </aside>
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
            ) : editorSection === "tiles" ? (
              <TileEditor
                key={selectedGame.id}
                gameId={selectedGame.id}
                initialTileTypes={selectedGame.tileTypes}
                onSaved={updateTileTypes}
                onMessage={setLiveMessage}
              />
            ) : (
              <ContentEditor
                gameId={selectedGame.id}
                enabled={persistedGameIds.has(selectedGame.id)}
                section={editorSection}
                onMessage={setLiveMessage}
                onCountsChange={updateContentCounts}
              />
            )}
            <aside className="editor-preview" aria-label="보드 미리보기">
              <div><h2>맵 미리보기</h2><span>{skinNames[skin]}</span></div>
              <GameBoard geometryId={geometry} skinId={skin} tokens={tokens.slice(0, 2)} round={1} lastRoll={3} tileTypes={selectedGame.tileTypes} compact />
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
          <fieldset><legend>맵 템플릿</legend>{boardGeometryIds.map((id, index) => <label className="radio-card" key={id}><input type="radio" name="template" value={id} defaultChecked={index === 0} /><span>{id === "LOOP_24" || id === "SPIRAL_24" ? <Grid2X2 /> : <Gamepad2 />}<strong>{boardGeometries[id].name}</strong><small>{boardGeometries[id].description}</small></span></label>)}</fieldset>
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
          <label><span>6자리 참가 코드</span><input className="code-input" inputMode="numeric" name="code" pattern="[0-9]{6}" maxLength={6} placeholder="482731" required aria-describedby="code-help" value={joinCode} onChange={(event) => { const nextCode = event.target.value.replace(/\D/g, ""); setJoinCode(nextCode); setJoinRoomInfo(null); setJoinLookupStatus(nextCode.length === 6 ? "loading" : "idle"); }} /><small id="code-help">{joinLookupStatus === "loading" ? "방 정보를 확인하고 있습니다." : joinLookupStatus === "found" && joinRoomInfo ? `${joinRoomInfo.gameTitle} · ${joinRoomInfo.playMode === "TEAM" ? `${joinRoomInfo.teamCount}팀 팀전` : "개인전"}` : joinLookupStatus === "missing" ? "열려 있는 방을 찾지 못했습니다." : "숫자만 6자리 입력하세요."}</small></label>
          <label><span>닉네임</span><input name="nickname" minLength={2} maxLength={12} placeholder="별빛나침반" required /></label>
          {joinRoomInfo?.playMode === "TEAM" && <label><span>팀 선택</span><select name="teamNumber" defaultValue="1">{Array.from({ length: joinRoomInfo.teamCount }, (_, index) => index + 1).map((team) => <option key={team} value={team}>{team}팀</option>)}</select></label>}
          <button className="button button--primary button--full" type="submit" disabled={realtimeBusy || joinLookupStatus !== "found"}>{realtimeBusy ? "연결 중" : "게임에 참가하기"}</button>
        </form>
        <p className="privacy-note"><LockKeyhole /> 계정 없이 참가하며, 닉네임은 이 수업이 끝나면 삭제됩니다.</p>
      </DialogShell>
    </div>
  );
}
