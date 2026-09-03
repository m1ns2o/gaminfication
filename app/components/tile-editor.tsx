"use client";
import "../studio.css";

import { BookOpen, Coffee, Flag, Gift, Grid2X2, Save, Sparkles, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { defaultTileTypes, tileTypeLabels, type TileType } from "../lib/board";
import { SelectMenu } from "./select-menu";

const editableTypes: TileType[] = ["QUIZ", "BONUS", "EVENT", "REST"];

const typeMeta = {
  START: { label: tileTypeLabels.START, icon: Flag, tone: "start", hint: "모든 참가자가 이 칸에서 출발합니다." },
  QUIZ: { label: tileTypeLabels.QUIZ, icon: BookOpen, tone: "quiz", hint: "문제를 출제하고 점수를 얻습니다." },
  BONUS: { label: tileTypeLabels.BONUS, icon: Gift, tone: "bonus", hint: "지정 점수를 즉시 추가합니다." },
  EVENT: { label: tileTypeLabels.EVENT, icon: Zap, tone: "event", hint: "카드 덱에서 카드를 뽑습니다." },
  REST: { label: tileTypeLabels.REST, icon: Coffee, tone: "rest", hint: "이동 없이 한 차례 멈춥니다." },
} as const;

// 멘탈 모델: 왼쪽 인스펙터는 오른쪽 맵 미리보기에서 선택한 칸을 편집한다.
// tileTypes / selectedTileIndex 는 상위(스튜디오)가 소유해 맵과 공유한다.
export function TileEditor({
  gameId,
  tileTypes,
  selectedTileIndex,
  onChangeTile,
  onSaved,
  onMessage,
}: {
  gameId: string;
  tileTypes: TileType[];
  selectedTileIndex: number;
  onChangeTile: (index: number, type: TileType) => void;
  onSaved: (tileTypes: TileType[]) => void;
  onMessage: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const counts = useMemo(() => {
    const result: Record<TileType, number> = { START: 0, QUIZ: 0, BONUS: 0, EVENT: 0, REST: 0 };
    for (const type of tileTypes) result[type] += 1;
    return result;
  }, [tileTypes]);

  const selectedType = tileTypes[selectedTileIndex] ?? defaultTileTypes[selectedTileIndex] ?? "QUIZ";
  const isStart = selectedTileIndex === 0;
  const SelectedIcon = typeMeta[selectedType].icon;

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/games/${gameId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tileTypes }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "칸 구성을 저장하지 못했습니다.");
      onSaved(tileTypes);
      onMessage("24개 칸 구성을 저장했습니다. 다음에 만드는 방부터 적용됩니다.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "칸 구성을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="question-editor tile-inspector" aria-labelledby="tile-inspector-heading">
      <div className="question-editor__head">
        <div>
          <h2 id="tile-inspector-heading">칸 편집</h2>
          <p>오른쪽 맵에서 수정할 칸을 누르고, 역할을 지정해 주세요. 바꾼 내용은 맵에 바로 반영됩니다.</p>
        </div>
        <button className="button button--ink" type="button" onClick={() => void save()} disabled={busy}><Save aria-hidden="true" /> {busy ? "저장 중" : "칸 저장"}</button>
      </div>

      <div className="tile-inspector__selected">
        <span className="tile-inspector__number">{String(selectedTileIndex + 1).padStart(2, "0")}</span>
        <span className={`tile-inspector__mark tile-inspector__mark--${typeMeta[selectedType].tone}`} aria-hidden="true"><SelectedIcon /></span>
        <span className="tile-inspector__copy">
          <span className="mono-label">TILE {String(selectedTileIndex + 1).padStart(2, "0")}</span>
          <strong>{isStart ? "시작 칸" : `${selectedTileIndex + 1}번 칸 역할`}</strong>
          <small>{isStart ? "모든 참가자가 이 칸에서 출발합니다." : selectedType !== "QUIZ" ? tileTypeLabels[selectedType] : "퀴즈 칸에 문제은행의 문제가 순환 배치됩니다."}</small>
        </span>
      </div>

      <div className="tile-editor__summary" aria-label="칸 유형 요약">
        <span><Flag aria-hidden="true" /> 시작 {counts.START}</span>
        <span>퀴즈 {counts.QUIZ}</span>
        <span><Gift aria-hidden="true" /> 보너스 {counts.BONUS}</span>
        <span><Sparkles aria-hidden="true" /> 이벤트 {counts.EVENT}</span>
        <span>휴식 {counts.REST}</span>
      </div>

      {isStart ? (
        <div className="tile-inspector__lock" role="note"><Flag aria-hidden="true" /><span>시작 칸은 모든 보드에서 고정된 출발점입니다.</span></div>
      ) : (
        <div className="tile-inspector__type-field"><span>칸 유형</span><SelectMenu label="칸 유형" icon={Grid2X2} value={selectedType} options={editableTypes.map((type) => ({ value: type, label: tileTypeLabels[type] }))} onChange={(value) => onChangeTile(selectedTileIndex, value as TileType)} /></div>
      )}

      <p className="tile-inspector__note"><Sparkles aria-hidden="true" /><span>저장하면 이 구성이 실시간 게임 엔진에 복사됩니다. 문제와 카드는 역할이 같은 칸 위에서 순환합니다.</span></p>
    </section>
  );
}