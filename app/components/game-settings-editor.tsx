"use client";

import { Check, Flag, Palette, Save, Trophy } from "lucide-react";
import { FormEvent, useState } from "react";
import { skinNames, type BoardGeometryId, type SkinId } from "../lib/board";

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

  return (
    <section className="question-editor settings-editor" aria-labelledby="settings-editor-heading">
      <div className="question-editor__head"><div><h2 id="settings-editor-heading">기본 설정과 게임 규칙</h2><p>수업 정보, 보드 형태와 게임이 끝나는 조건을 설정합니다.</p></div><span className="settings-editor__status"><Check aria-hidden="true" /> 비공개 초안</span></div>
      <form className="question-form" onSubmit={save}>
        <label><span>게임 제목</span><input value={draft.title} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} required /></label>
        <label><span>수업 설명</span><textarea value={draft.description} maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="학습 목표와 진행 방법을 적어 주세요." /></label>
        <div className="form-row form-row--split">
          <label><span>과목</span><input value={draft.subject} maxLength={30} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} /></label>
          <label><span>학년</span><input value={draft.grade} maxLength={30} onChange={(event) => setDraft((current) => ({ ...current, grade: event.target.value }))} /></label>
        </div>
        <div className="form-row form-row--split">
          <label><span>참가 방식</span><select value={draft.playMode} onChange={(event) => setDraft((current) => ({ ...current, playMode: event.target.value as EditableGameSettings["playMode"] }))}><option value="INDIVIDUAL">개인전</option><option value="TEAM">팀전</option></select></label>
          {draft.playMode === "TEAM" ? <label><span>팀 수</span><select value={draft.teamCount} onChange={(event) => setDraft((current) => ({ ...current, teamCount: Number(event.target.value) }))}>{[2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count}팀</option>)}</select></label> : <div className="rule-settings__note"><Flag aria-hidden="true" /><span>개인별 점수와 순위를 기록합니다.</span></div>}
        </div>
        <div className="form-row form-row--split">
          <label><span>보드 형태</span><select value={draft.template} onChange={(event) => setDraft((current) => ({ ...current, template: event.target.value as BoardGeometryId }))}><option value="LOOP_24">24칸 순환형</option><option value="RACE_24">24칸 직선 레이스</option></select></label>
          <label><span><Palette aria-hidden="true" /> 보드 스킨</span><select value={draft.skin} onChange={(event) => setDraft((current) => ({ ...current, skin: event.target.value as SkinId }))}>{(Object.keys(skinNames) as SkinId[]).map((id) => <option key={id} value={id}>{skinNames[id]}</option>)}</select></label>
        </div>
        <fieldset className="rule-settings"><legend><Trophy aria-hidden="true" /> 종료 조건</legend><label><span>승리 방식</span><select value={draft.victoryMode} onChange={(event) => setDraft((current) => ({ ...current, victoryMode: event.target.value as EditableGameSettings["victoryMode"] }))}><option value="AUTO">보드에 맞게 자동</option><option value="SCORE">목표 점수 도달</option><option value="ROUNDS">정해진 라운드 종료</option><option value="FINISH">마지막 칸 먼저 도착</option></select></label>{(draft.victoryMode === "AUTO" ? draft.template === "RACE_24" ? "FINISH" : "SCORE" : draft.victoryMode) === "SCORE" && <label><span>목표 점수</span><input type="number" min="10" max="1000" step="10" value={draft.targetScore} onChange={(event) => setDraft((current) => ({ ...current, targetScore: Number(event.target.value) }))} /></label>}{draft.victoryMode === "ROUNDS" && <label><span>최대 라운드</span><input type="number" min="1" max="50" value={draft.maxRounds} onChange={(event) => setDraft((current) => ({ ...current, maxRounds: Number(event.target.value) }))} /></label>}<div className="rule-settings__note"><Flag aria-hidden="true" /><span>{draft.victoryMode === "AUTO" ? draft.template === "RACE_24" ? "직선형은 마지막 칸에 먼저 도착하면 끝납니다." : `순환형은 ${draft.targetScore}점에 먼저 도달하면 끝납니다.` : draft.victoryMode === "SCORE" ? `${draft.targetScore}점에 먼저 도달한 참가자가 승리합니다.` : draft.victoryMode === "ROUNDS" ? `${draft.maxRounds}라운드 종료 후 점수가 가장 높은 참가자가 승리합니다.` : "마지막 칸에 먼저 도착한 참가자가 승리합니다."}</span></div></fieldset>
        <div className="question-form__actions"><button className="button button--ink" type="submit" disabled={busy}><Save aria-hidden="true" /> {busy ? "저장 중" : "설정 저장"}</button></div>
      </form>
    </section>
  );
}
