export type BoardGeometryId = "LOOP_24" | "RACE_24";
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
  aspectRatio: number;
  columns: number;
  rows: number;
  tiles: BoardTile[];
};

const types: TileType[] = [
  "START", "QUIZ", "BONUS", "QUIZ", "EVENT", "QUIZ", "REST", "QUIZ",
  "BONUS", "QUIZ", "EVENT", "QUIZ", "REST", "QUIZ", "BONUS", "QUIZ",
  "EVENT", "QUIZ", "REST", "QUIZ", "BONUS", "QUIZ", "EVENT", "QUIZ",
];

const labels: Record<TileType, string> = {
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

function makeTiles(coords: Array<{ x: number; y: number; rotation: number }>) {
  return coords.map((position, index) => ({
    index,
    ...position,
    type: types[index],
    label: labels[types[index]],
  }));
}

export const boardGeometries: Record<BoardGeometryId, BoardGeometry> = {
  LOOP_24: {
    id: "LOOP_24",
    aspectRatio: 1,
    columns: 7,
    rows: 7,
    tiles: makeTiles(loopCoordinates),
  },
  RACE_24: {
    id: "RACE_24",
    aspectRatio: 8 / 3,
    columns: 8,
    rows: 3,
    tiles: makeTiles(raceCoordinates),
  },
};

export const skinNames: Record<SkinId, string> = {
  CAMPUS: "배움 캠퍼스",
  SPACE_LAB: "탐구 우주기지",
  ECO_EXPEDITION: "생태 원정대",
};
