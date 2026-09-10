"use client";
import "../studio.css";

import { Check, Flag, Grid2X2, Palette, Save, Trophy, Users } from "lucide-react";
import { FormEvent, useState } from "react";
import { boardGeometries, boardGeometryIds, skinNames, type BoardGeometryId, type SkinId } from "../lib/board";
import { SelectMenu } from "./select-menu";

export type EditableGameSettings = {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade: string;
  template: BoardGeometryId;
  skin: SkinId;
  victoryMode: "AUTO" | "SCORE" | "ROUNDS" | "FINISH";
  targetScore: number;
  maxRounds: number;
  playMode: "INDIVIDUAL" | "TEAM";
  teamCount: number;
};

export function GameSettingsEditor({
  game,
  onSaved,
  onMessage,
}: {
  game: EditableGameSettings;
  onSaved: (game: EditableGameSettings) => void;
  onMessage: (message: string) => void;
}) {
  const [draft, setDraft] = useState(game);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/games/${game.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json() as { game?: EditableGameSettings; error?: { message?: string } };
      if (!response.ok || !payload.game) throw new Error(payload.error?.message ?? "게임 설정을 저장하지 못했습니다.");
      setDraft(payload.game);
      onSaved(payload.game);
      onMessage("기본 설정과 종료 규칙을 저장했습니다.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "게임 설정을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const automaticVictoryMode = boardGeometries[draft.template].wraps ? "SCORE" : "FINISH";

  return (
    <section className="question-editor settings-editor" aria-labelledby="settings-editor-heading">
      <div className="question-editor__head"><div><h2 id="settings-editor-heading">게임 설정</h2><p>수업 정보와 종료 조건을 설정합니다.</p></div><span className="settings-editor__status"><Check aria-hidden="true" /> 비공개 초안</span></div>
      <form className="question-form" onSubmit={save}>
        <label><span>게임 제목</span><input value={draft.title} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} required /></label>
        <label><span>수업 설명</span><textarea value={draft.description} maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="학습 목표와 진행 방법을 적어 주세요." /></label>
        <div className="form-row form-row--split">
          <label><span>과목</span><input value={draft.subject} maxLength={30} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} /></label>
          <label><span>학년</span><input value={draft.grade} maxLength={30} onChange={(event) => setDraft((current) => ({ ...current, grade: event.target.value }))} /></label>
        </div>
        <div className="form-row form-row--split">
          <div className="form-field"><span>참가 방식</span><SelectMenu label="참가 방식" icon={Users} value={draft.playMode} options={[{ value: "INDIVIDUAL", label: "개인전" }, { value: "TEAM", label: "팀전" }]} onChange={(value) => setDraft((current) => ({ ...current, playMode: value as EditableGameSettings["playMode"] }))} /></div>
          {draft.playMode === "TEAM" ? <div className="form-field"><span>팀 수</span><SelectMenu label="팀 수" icon={Users} value={String(draft.teamCount)} options={[2, 3, 4, 5, 6, 7, 8].map((count) => ({ value: String(count), label: `${count}팀` }))} onChange={(value) => setDraft((current) => ({ ...current, teamCount: Number(value) }))} /></div> : <div className="rule-settings__note"><Flag aria-hidden="true" /><span>개인별 점수와 순위를 기록합니다.</span></div>}
        </div>
        <div className="form-row form-row--split">
          <div className="form-field"><span>보드 형태</span><SelectMenu label="보드 형태" icon={Grid2X2} value={draft.template} options={boardGeometryIds.map((id) => ({ value: id, label: boardGeometries[id].name }))} onChange={(value) => setDraft((current) => ({ ...current, template: value as BoardGeometryId }))} /></div>
          <div className="form-field"><span>보드 스킨</span><SelectMenu label="보드 스킨" icon={Palette} value={draft.skin} options={(Object.keys(skinNames) as SkinId[]).map((id) => ({ value: id, label: skinNames[id] }))} onChange={(value) => setDraft((current) => ({ ...current, skin: value as SkinId }))} /></div>
        </div>
        <fieldset className="rule-settings"><legend><Trophy aria-hidden="true" /> 종료 조건</legend><div className="rule-settings__panel"><div className="form-field"><span>승리 방식</span><SelectMenu label="승리 방식" icon={Trophy} value={draft.victoryMode} options={[{ value: "AUTO", label: "보드에 맞게 자동" }, { value: "SCORE", label: "목표 점수" }, { value: "ROUNDS", label: "라운드 종료" }, { value: "FINISH", label: "마지막 칸 도착" }]} onChange={(value) => setDraft((current) => ({ ...current, victoryMode: value as EditableGameSettings["victoryMode"] }))} /></div>{(draft.victoryMode === "AUTO" ? automaticVictoryMode : draft.victoryMode) === "SCORE" && <label><span>목표 점수</span><input type="number" min="10" max="1000" step="10" value={draft.targetScore} onChange={(event) => setDraft((current) => ({ ...current, targetScore: Number(event.target.value) }))} /></label>}{draft.victoryMode === "ROUNDS" && <label><span>최대 라운드</span><input type="number" min="1" max="50" value={draft.maxRounds} onChange={(event) => setDraft((current) => ({ ...current, maxRounds: Number(event.target.value) }))} /></label>}<div className="rule-settings__note"><Flag aria-hidden="true" /><span>{draft.victoryMode === "AUTO" ? automaticVictoryMode === "FINISH" ? `마지막 칸 도착 시 종료` : `순환형 · ${draft.targetScore}점 선착` : draft.victoryMode === "SCORE" ? `${draft.targetScore}점 선착` : draft.victoryMode === "ROUNDS" ? `${draft.maxRounds}라운드 후 최고점 승리` : "마지막 칸 도착 시 종료"}</span></div></div></fieldset>
        <div className="question-form__actions"><button className="button button--ink" type="submit" disabled={busy}><Save aria-hidden="true" /> {busy ? "저장 중" : "설정 저장"}</button></div>
      </form>
    </section>
  );
}
