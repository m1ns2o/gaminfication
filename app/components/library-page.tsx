"use client";
import "../studio.css";

import { Search, SearchX, RotateCcw, GraduationCap, BookOpen, Eye, Copy, X } from "lucide-react";
import type { LibraryGame } from "../lib/game-types";
import { boardGeometries } from "../lib/board";
import { FilterDropdown } from "./filter-dropdown";
import { GameBoard } from "./game-board";
import { Library } from "lucide-react";

const gradeGroups = [
  { stage: "초등", years: 6 },
  { stage: "중등", years: 3 },
  { stage: "고등", years: 3 },
];
const subjectGroups: { group: string; options: { value: string; label: string }[] }[] = [
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

export function LibraryPage({
  games,
  loading,
  search,
  gradeFilter,
  subjectFilter,
  onSearchChange,
  onGradeFilter,
  onSubjectFilter,
  onResetFilters,
  onOpenCreate,
  onClone,
  onBackToDashboard,
}: {
  games: LibraryGame[];
  loading: boolean;
  search: string;
  gradeFilter: string;
  subjectFilter: string;
  onSearchChange: (value: string) => void;
  onGradeFilter: (value: string) => void;
  onSubjectFilter: (value: string) => void;
  onResetFilters: () => void;
  onOpenCreate: () => void;
  onClone: (game: LibraryGame) => void;
  onBackToDashboard: () => void;
}) {
  const hasLibraryFilter = gradeFilter !== "전체" || subjectFilter !== "전체" || search.trim() !== "";

  return (
    <main className="library-page">
      <header className="library-hero">
        <div>
          <span className="library-hero__mark" aria-hidden="true"><Library /></span>
          <h1>선생님들의 수업 게임</h1>
          <p>과목과 학년에 맞는 게임을 찾아 미리 보고, 내 수업용 비공개 초안으로 복제하세요.</p>
        </div>
        <button className="button button--primary" type="button" onClick={onOpenCreate}><Library /> 처음부터 만들기</button>
      </header>
      <section className="library-tools" aria-label="공유마당 검색과 필터">
        <label className="search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">게임 검색</span>
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="제목, 설명으로 검색" />
        </label>
        <div className="library-dropdowns" role="group" aria-label="학년과 과목으로 찾기">
          <FilterDropdown
            label="전체 학년"
            icon={GraduationCap}
            value={gradeFilter}
            onSelect={onGradeFilter}
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
            onSelect={onSubjectFilter}
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
              <button className="active-filters__chip" type="button" onClick={() => onGradeFilter("전체")}>
                <GraduationCap aria-hidden="true" />
                {gradeFilter}
                <X aria-hidden="true" />
                <span className="sr-only">학년 필터 지우기</span>
              </button>
            )}
            {subjectFilter !== "전체" && (
              <button className="active-filters__chip" type="button" onClick={() => onSubjectFilter("전체")}>
                <BookOpen aria-hidden="true" />
                {subjectFilter}
                <X aria-hidden="true" />
                <span className="sr-only">과목 필터 지우기</span>
              </button>
            )}
            <button className="text-button active-filters__reset" type="button" onClick={onResetFilters}>
              <RotateCcw aria-hidden="true" /> 필터 초기화
            </button>
          </div>
        )}
      </section>
      <section className="library-results" aria-labelledby="library-results-heading">
        <div className="library-results__head">
          <h2 id="library-results-heading">{hasLibraryFilter ? "검색 결과" : "추천 게임"}</h2>
          <span aria-live="polite">{loading ? "불러오는 중" : `${games.length}개 결과`}</span>
        </div>
        {loading ? (
          <div className="library-empty">
            <strong>게임을 불러오는 중</strong>
            <p>공유마당에서 선생님들의 게임을 가져오고 있습니다.</p>
          </div>
        ) : games.length === 0 ? (
          <div className="library-empty">
            <SearchX aria-hidden="true" />
            <strong>아직 공개된 게임이 없어요</strong>
            <p>내 게임을 발행하면 이곳에 소개됩니다.</p>
            <button className="button button--quiet" type="button" onClick={onResetFilters}><RotateCcw aria-hidden="true" /> 필터 초기화</button>
          </div>
        ) : (
          <div className="library-grid">
            {games.map((game, index) => (
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
                  <button className="button button--ink" type="button" onClick={() => onClone(game)}><Copy /> 복제</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="library-back">
        <button className="text-button" type="button" onClick={onBackToDashboard}><RotateCcw aria-hidden="true" /> 내 게임으로 돌아가기</button>
      </div>
    </main>
  );
}
