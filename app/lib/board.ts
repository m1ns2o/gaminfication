export type BoardGeometryId = "LOOP_24" | "RACE_24" | "LINE_24" | "SPIRAL_24";
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

const raceCoordinates = Array.from({ length: 24 }, (_, index) => {
  const row = Math.floor(index / 8);
  const offset = index % 8;
  const x = row % 2 === 0 ? offset : 7 - offset;
  return { x, y: row, rotation: row % 2 === 0 ? 0 : 180 };
});

const lineCoordinates = Array.from({ length: 24 }, (_, index) => ({
  x: index,
  y: 0,
  rotation: 0,
}));

const spiralCoordinates = [
  ...Array.from({ length: 5 }, (_, x) => ({ x, y: 0, rotation: 0 })),
  ...Array.from({ length: 4 }, (_, offset) => ({ x: 4, y: offset + 1, rotation: 90 })),
  ...Array.from({ length: 4 }, (_, offset) => ({ x: 3 - offset, y: 4, rotation: 180 })),
  ...Array.from({ length: 3 }, (_, offset) => ({ x: 0, y: 3 - offset, rotation: 270 })),
  ...Array.from({ length: 3 }, (_, offset) => ({ x: offset + 1, y: 1, rotation: 0 })),
  ...Array.from({ length: 2 }, (_, offset) => ({ x: 3, y: offset + 2, rotation: 90 })),
  ...Array.from({ length: 2 }, (_, offset) => ({ x: 2 - offset, y: 3, rotation: 180 })),
  { x: 2, y: 2, rotation: 270 },
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
  RACE_24: {
    id: "RACE_24",
    name: "24칸 지그재그 레이스",
    shortName: "지그재그",
    description: "세 줄을 빠르게 오가며 결승점에 도착하는 코스",
    wraps: false,
    aspectRatio: 8 / 3,
    columns: 8,
    rows: 3,
    tiles: makeTiles(raceCoordinates),
  },
  LINE_24: {
    id: "LINE_24",
    name: "24칸 일직선 스프린트",
    shortName: "일직선",
    description: "시작부터 결승까지 한 방향으로 이어지는 가로 코스",
    wraps: false,
    aspectRatio: 6,
    columns: 24,
    rows: 1,
    tiles: makeTiles(lineCoordinates),
  },
  SPIRAL_24: {
    id: "SPIRAL_24",
    name: "24칸 나선 탐험",
    shortName: "나선형",
    description: "바깥에서 중심 결승점으로 들어가는 집중형 코스",
    wraps: false,
    aspectRatio: 1,
    columns: 5,
    rows: 5,
    tiles: makeTiles(spiralCoordinates),
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
