"use client";

import { Flag, Gift, Save, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { defaultTileTypes, tileTypeLabels, type TileType } from "../lib/board";

const editableTypes: TileType[] = ["QUIZ", "BONUS", "EVENT", "REST"];

export function TileEditor({
  gameId,
  initialTileTypes,
  onSaved,
  onMessage,
}: {
  gameId: string;
  initialTileTypes?: TileType[];
  onSaved: (tileTypes: TileType[]) => void;
  onMessage: (message: string) => void;
}) {
  const [tileTypes, setTileTypes] = useState<TileType[]>(() => initialTileTypes?.length === 24 ? [...initialTileTypes] : [...defaultTileTypes]);
  const [selectedIndex, setSelectedIndex] = useState(1);
  const [busy, setBusy] = useState(false);
  const counts = useMemo(() => {
    const result: Record<TileType, number> = { START: 0, QUIZ: 0, BONUS: 0, EVENT: 0, REST: 0 };
    for (const type of tileTypes) result[type] += 1;
    return result;
  }, [tileTypes]);

  function changeSelected(type: TileType) {
    setTileTypes((current) => current.map((currentType, index) => index === selectedIndex ? type : currentType));
  }

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
    <section className="question-editor tile-editor" aria-labelledby="tile-editor-heading">
      <div className="question-editor__head"><div><h2 id="tile-editor-heading">칸 편집</h2><p>칸을 선택하고 수업 흐름에 맞는 역할을 지정하세요.</p></div><button className="button button--ink" type="button" onClick={() => void save()} disabled={busy}><Save aria-hidden="true" /> {busy ? "저장 중" : "칸 저장"}</button></div>
      <div className="tile-editor__summary" aria-label="칸 유형 요약"><span><Flag aria-hidden="true" /> 시작 {counts.START}</span><span>퀴즈 {counts.QUIZ}</span><span><Gift aria-hidden="true" /> 보너스 {counts.BONUS}</span><span><Sparkles aria-hidden="true" /> 이벤트 {counts.EVENT}</span><span>휴식 {counts.REST}</span></div>
      <div className="tile-editor__grid" aria-label="24개 보드 칸">{tileTypes.map((type, index) => <button key={index} type="button" className={`tile-editor__tile tile-editor__tile--${type.toLowerCase()}${selectedIndex === index ? " is-selected" : ""}`} aria-pressed={selectedIndex === index} onClick={() => setSelectedIndex(index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{tileTypeLabels[type]}</strong></button>)}</div>
      <div className="tile-editor__inspector"><div><span className="mono-label">TILE {String(selectedIndex + 1).padStart(2, "0")}</span><h3>{selectedIndex === 0 ? "시작 칸" : `${selectedIndex + 1}번 칸 설정`}</h3><p>{selectedIndex === 0 ? "시작 칸은 모든 보드에서 고정됩니다." : "게임방을 새로 만들면 이 구성이 실시간 엔진에 복사됩니다."}</p></div><label><span>칸 유형</span><select value={tileTypes[selectedIndex]} onChange={(event) => changeSelected(event.target.value as TileType)} disabled={selectedIndex === 0}>{selectedIndex === 0 && <option value="START">시작</option>}{editableTypes.map((type) => <option key={type} value={type}>{tileTypeLabels[type]}</option>)}</select></label></div>
    </section>
  );
}
