export type BoardGeometryId = "LOOP_24";
export type SkinId = "CAMPUS" | "SPACE_LAB" | "ECO_EXPEDITION";
export type TileType = "START" | "QUIZ" | "BONUS" | "EVENT" | "REST";

export type BoardTile = {
  index: number;
  x: number;
  y: number;
  rotation: number;
  type: TileType;
  label: string;
};

export type BoardGeometry = {
  id: BoardGeometryId;
  name: string;
  shortName: string;
  description: string;
  wraps: boolean;
  aspectRatio: number;
  columns: number;
  rows: number;
  tiles: BoardTile[];
};

export const defaultTileTypes: TileType[] = [
  "START", "QUIZ", "BONUS", "QUIZ", "EVENT", "QUIZ", "REST", "QUIZ",
  "BONUS", "QUIZ", "EVENT", "QUIZ", "REST", "QUIZ", "BONUS", "QUIZ",
  "EVENT", "QUIZ", "REST", "QUIZ", "BONUS", "QUIZ", "EVENT", "QUIZ",
];

export const tileTypeLabels: Record<TileType, string> = {
  START: "시작",
  QUIZ: "퀴즈",
  BONUS: "보너스",
  EVENT: "이벤트",
  REST: "휴식",
};

const loopCoordinates = [
  ...Array.from({ length: 7 }, (_, x) => ({ x, y: 0, rotation: 0 })),
  ...Array.from({ length: 6 }, (_, offset) => ({ x: 6, y: offset + 1, rotation: 90 })),
  ...Array.from({ length: 6 }, (_, offset) => ({ x: 5 - offset, y: 6, rotation: 180 })),
  ...Array.from({ length: 5 }, (_, offset) => ({ x: 0, y: 5 - offset, rotation: 270 })),
];

function makeTiles(coords: Array<{ x: number; y: number; rotation: number }>) {
  return coords.map((position, index) => ({
    index,
    ...position,
    type: defaultTileTypes[index],
    label: tileTypeLabels[defaultTileTypes[index]],
  }));
}

export const boardGeometries: Record<BoardGeometryId, BoardGeometry> = {
  LOOP_24: {
    id: "LOOP_24",
    name: "24칸 순환 광장",
    shortName: "순환형",
    description: "중앙 무대를 둘러 반복해서 도는 수업형 보드",
    wraps: true,
    aspectRatio: 1,
    columns: 7,
    rows: 7,
    tiles: makeTiles(loopCoordinates),
  },
};

export const boardGeometryIds = Object.keys(boardGeometries) as BoardGeometryId[];

export function advanceBoardPosition(geometryId: BoardGeometryId, position: number, amount: number) {
  if (boardGeometries[geometryId].wraps) return (position + amount + 24) % 24;
  return Math.min(23, Math.max(0, position + amount));
}

export function boardStepPath(geometryId: BoardGeometryId, from: number, to: number, direction: 1 | -1 = 1) {
  const path: number[] = [];
  let current = from;
  for (let step = 0; step < 24 && current !== to; step += 1) {
    current = advanceBoardPosition(geometryId, current, direction);
    path.push(current);
    if (!boardGeometries[geometryId].wraps && (current === 0 || current === 23) && current !== to) break;
  }
  return path;
}

export const skinNames: Record<SkinId, string> = {
  CAMPUS: "배움 캠퍼스",
  SPACE_LAB: "탐구 우주기지",
  ECO_EXPEDITION: "생태 원정대",
};
