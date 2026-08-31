"use client";

import "./webgl-game-board.css";

/* eslint-disable react/no-unknown-property -- React Three Fiber extends JSX with Three.js scene primitives. */
/* eslint-disable react-hooks/immutability -- Three.js camera and scene objects are intentionally mutable. */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Clone, ContactShadows, OrbitControls, RoundedBox, useGLTF } from "@react-three/drei";
import { CuboidCollider, Physics, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CanvasTexture, Color, Group, MathUtils, Quaternion, SRGBColorSpace, Vector3 } from "three";
import {
  boardGeometries,
  skinNames,
  tileTypeLabels,
  type BoardGeometryId,
  type SkinId,
  type TileType,
} from "../../app/lib/board";

type WebGlToken = {
  id: string;
  label: string;
  position: number;
  symbol: "book" | "bulb" | "compass" | "leaf" | "rocket";
  active?: boolean;
};

type WebGLGameBoardProps = {
  geometryId: BoardGeometryId;
  skinId: SkinId;
  tokens: WebGlToken[];
  round: number;
  lastRoll: number;
  currentTurnLabel: string;
  eventLabel: string;
  tileTypes?: TileType[];
  currentStep: number | null;
  landedIndex: number | null;
  movingTokenId: string | null;
  rolling: boolean;
  rollPhase: "rolling" | "result";
  rollCycle: number;
  reducedMotion: boolean;
  controls?: ReactNode;
};

type Palette = {
  board: Color;
  boardDeep: Color;
  terrain: Color;
  terrainDeep: Color;
  surface: Color;
  ink: Color;
  quiz: Color;
  bonus: Color;
  event: Color;
  rest: Color;
  coral: Color;
  violet: Color;
  sky: Color;
  cream: Color;
  pip: Color;
  pawn: Record<WebGlToken["symbol"], Color>;
};

const TILE_STEP = 1.28;
const TILE_SIZE = 1.08;
const DEFAULT_COLOR = new Color(0xffffff);

function cssColorToThree(value: string) {
  if (typeof document === "undefined") return DEFAULT_COLOR.clone();
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return DEFAULT_COLOR.clone();
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return new Color(red / 255, green / 255, blue / 255).convertSRGBToLinear();
}

function usePalette() {
  const [palette, setPalette] = useState<Palette | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const styles = window.getComputedStyle(document.documentElement);
      const read = (token: string) => cssColorToThree(styles.getPropertyValue(token).trim());
      setPalette({
        board: read("--color-indigo"),
        boardDeep: read("--color-indigo-deep"),
        terrain: read("--color-grass"),
        terrainDeep: read("--color-grass-deep"),
        surface: read("--color-surface"),
        ink: read("--color-ink"),
        quiz: read("--color-surface"),
        bonus: read("--color-amber-soft"),
        event: read("--color-violet-soft"),
        rest: read("--color-teal-soft"),
        coral: read("--color-coral"),
        violet: read("--color-violet"),
        sky: read("--color-sky"),
        cream: read("--color-die"),
        pip: read("--color-pip"),
        pawn: {
          book: read("--color-amber"),
          bulb: read("--color-coral"),
          compass: read("--color-indigo"),
          leaf: read("--color-teal"),
          rocket: read("--color-violet"),
        },
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return palette;
}

function tilePosition(geometryId: BoardGeometryId, position: number) {
  const geometry = boardGeometries[geometryId];
  const tile = geometry.tiles[MathUtils.clamp(position, 0, geometry.tiles.length - 1)];
  return new Vector3(
    (tile.x - (geometry.columns - 1) / 2) * TILE_STEP,
    0.82,
    (tile.y - (geometry.rows - 1) / 2) * TILE_STEP,
  );
}

function BoardCamera({ geometryId }: { geometryId: BoardGeometryId }) {
  const { camera, size } = useThree();
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const geometry = boardGeometries[geometryId];

  useLayoutEffect(() => {
    // Include the plinth, pawn silhouettes and their labels in the fit bounds.
    // The extra breathing room matters on portrait phones where the oblique
    // tabletop projects farther sideways than the board's raw tile bounds.
    const width = geometry.columns * TILE_STEP + 3.6;
    const depth = geometry.rows * TILE_STEP + 3.4;
    const aspect = Math.max(0.7, size.width / Math.max(size.height, 1));
    const verticalFit = Math.max(depth, width / aspect);
    const distance = Math.max(8.4, verticalFit * (geometryId === "LINE_24" ? 1.1 : 1.27));
    const direction = new Vector3(0.66, 0.78, 1.22).normalize();
    camera.position.copy(direction.multiplyScalar(distance));
    camera.near = 0.1;
    camera.far = Math.max(80, distance * 5);
    camera.lookAt(0, 0.5, 0);
    camera.updateProjectionMatrix();
    controlsRef.current?.target.set(0, 0.5, 0);
    controlsRef.current?.update();
  }, [camera, geometry.columns, geometry.rows, geometryId, size.height, size.width]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={6.5}
      maxDistance={48}
      minPolarAngle={0.62}
      maxPolarAngle={1.16}
      minAzimuthAngle={-1.25}
      maxAzimuthAngle={0.65}
    />
  );
}

function useCanvasLabel({
  primary,
  secondary,
  foreground,
  accent,
  surface,
  mode,
}: {
  primary: string;
  secondary: string;
  foreground: Color;
  accent: Color;
  surface: Color;
  mode: "tile" | "pawn";
}) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = mode === "tile" ? 384 : 512;
    canvas.height = mode === "tile" ? 384 : 160;
    const context = canvas.getContext("2d");
    if (!context) return;
    const styles = window.getComputedStyle(document.body);
    const family = styles.fontFamily || "sans-serif";
    const width = canvas.width;
    const height = canvas.height;

    context.clearRect(0, 0, width, height);
    if (mode === "pawn") {
      const radius = 58;
      context.beginPath();
      context.roundRect(8, 8, width - 16, height - 16, radius);
      context.fillStyle = surface.getStyle();
      context.fill();
      context.lineWidth = 12;
      context.strokeStyle = foreground.getStyle();
      context.stroke();
      context.fillStyle = accent.getStyle();
      context.beginPath();
      context.arc(54, height / 2, 18, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = foreground.getStyle();
      context.font = `800 54px ${family}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(primary, width / 2 + 20, height / 2 + 2, width - 138);
    } else {
      context.fillStyle = accent.getStyle();
      context.beginPath();
      context.roundRect(38, 34, 108, 66, 28);
      context.fill();
      context.fillStyle = foreground.getStyle();
      context.font = `800 38px ${family}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(secondary, 92, 68);
      context.font = `900 70px ${family}`;
      context.fillText(primary, width / 2, 238, width - 48);
      context.lineWidth = 10;
      context.lineCap = "round";
      context.strokeStyle = foreground.getStyle();
      context.beginPath();
      context.moveTo(72, 320);
      context.lineTo(width - 72, 320);
      context.stroke();
    }

    const nextTexture = new CanvasTexture(canvas);
    nextTexture.colorSpace = SRGBColorSpace;
    nextTexture.anisotropy = 4;
    nextTexture.needsUpdate = true;
    const frame = window.requestAnimationFrame(() => setTexture(nextTexture));
    return () => {
      window.cancelAnimationFrame(frame);
      nextTexture.dispose();
    };
  }, [accent, foreground, mode, primary, secondary, surface]);

  return texture;
}

function TileLabel({ index, label, palette, type }: { index: number; label: string; palette: Palette; type: TileType }) {
  const accent = type === "BONUS" ? palette.coral : type === "EVENT" ? palette.violet : type === "REST" ? palette.terrainDeep : palette.board;
  const texture = useCanvasLabel({
    primary: label,
    secondary: String(index + 1).padStart(2, "0"),
    foreground: palette.ink,
    accent,
    surface: palette.surface,
    mode: "tile",
  });
  if (!texture) return null;
  return (
    <mesh position={[0, 0.183, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[TILE_SIZE * 0.82, TILE_SIZE * 0.82]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function PawnLabel({ label, active, palette }: { label: string; active: boolean; palette: Palette }) {
  const texture = useCanvasLabel({
    primary: label,
    secondary: "",
    foreground: palette.ink,
    accent: active ? palette.coral : palette.board,
    surface: active ? palette.bonus : palette.surface,
    mode: "pawn",
  });
  if (!texture) return null;
  return (
    <Billboard position={[0, 1.16, 0]} follow lockX={false} lockY={false} lockZ={false}>
      <mesh>
        <planeGeometry args={[1.26, 0.39]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function ModelAsset({
  url,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const { scene } = useGLTF(url);
  return <Clone object={scene} position={position} rotation={rotation} scale={scale} castShadow receiveShadow />;
}

const PLAYER_MODELS: Record<WebGlToken["symbol"], string> = {
  book: "/assets/kenney/characters/character-i.glb",
  bulb: "/assets/kenney/characters/character-f.glb",
  compass: "/assets/kenney/characters/character-m.glb",
  leaf: "/assets/kenney/characters/character-k.glb",
  rocket: "/assets/kenney/characters/character-o.glb",
};

function TileBlock({
  geometryId,
  index,
  type,
  label,
  palette,
  current,
  landed,
}: {
  geometryId: BoardGeometryId;
  index: number;
  type: TileType;
  label: string;
  palette: Palette;
  current: boolean;
  landed: boolean;
}) {
  const group = useRef<Group>(null);
  const position = tilePosition(geometryId, index);
  const tileColor = {
    START: palette.quiz,
    QUIZ: palette.quiz,
    BONUS: palette.bonus,
    EVENT: palette.event,
    REST: palette.rest,
  }[type];

  useFrame((_, delta) => {
    if (!group.current) return;
    const targetY = position.y + (current ? 0.3 : landed ? 0.2 : 0);
    group.current.position.y = MathUtils.damp(group.current.position.y, targetY, 10, delta);
    const targetScale = landed ? 1.06 : 1;
    const scale = MathUtils.damp(group.current.scale.x, targetScale, 9, delta);
    group.current.scale.setScalar(scale);
  });

  return (
    <group ref={group} position={position}>
      <RoundedBox args={[TILE_SIZE, 0.34, TILE_SIZE]} radius={0.11} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color={tileColor} roughness={0.5} metalness={0.02} />
      </RoundedBox>
      <mesh position={[0, -0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[TILE_SIZE * 0.94, 0.2, TILE_SIZE * 0.94]} />
        <meshStandardMaterial color={current || landed ? palette.coral : palette.boardDeep} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.29, 24]} />
        <meshStandardMaterial color={type === "EVENT" ? palette.violet : palette.board} roughness={0.45} />
      </mesh>
      <TileLabel index={index} label={label} palette={palette} type={type} />
    </group>
  );
}

function ThemeLandmarks({ geometryId, skinId, boardDepth }: { geometryId: BoardGeometryId; skinId: SkinId; boardDepth: number }) {
  const hasCentre = geometryId === "LOOP_24" || geometryId === "SPIRAL_24";
  const compact = geometryId === "SPIRAL_24";
  const groupPosition: [number, number, number] = hasCentre ? [0, 0.72, 0] : [0, 0.72, -boardDepth / 2 - 0.48];
  const groupScale = compact ? 0.7 : hasCentre ? 1.02 : 0.68;

  if (skinId === "ECO_EXPEDITION") {
    return (
      <group position={groupPosition} scale={groupScale}>
        <ModelAsset url="/assets/kenney/forest/tent.glb" position={[-0.78, 0, 0.22]} rotation={[0, 0.35, 0]} scale={0.82} />
        <ModelAsset url="/assets/kenney/forest/tree.glb" position={[0.92, 0, -0.18]} rotation={[0, -0.2, 0]} scale={1.08} />
        <ModelAsset url="/assets/kenney/forest/rocks-low.glb" position={[0.58, 0, 0.7]} rotation={[0, 0.5, 0]} scale={0.72} />
        <ModelAsset url="/assets/kenney/forest/plant.glb" position={[-0.02, 0, -0.62]} scale={0.88} />
        <ModelAsset url="/assets/kenney/forest/plant.glb" position={[-1.04, 0, -0.54]} rotation={[0, -0.35, 0]} scale={0.62} />
      </group>
    );
  }

  if (skinId === "SPACE_LAB") {
    return (
      <group position={groupPosition} scale={groupScale * 0.42}>
        <ModelAsset url="/assets/kenney/space/gate-door.glb" position={[-1.02, 0, 0.04]} rotation={[0, 0.12, 0]} scale={0.72} />
        <ModelAsset url="/assets/kenney/space/corridor-end.glb" position={[1.02, 0, 0.12]} rotation={[0, Math.PI, 0]} scale={0.62} />
        <ModelAsset url="/assets/kenney/space/cables.glb" position={[0.04, 0.04, -0.92]} rotation={[0, 0.4, 0]} scale={0.72} />
      </group>
    );
  }

  return (
    <group position={groupPosition} scale={groupScale}>
      <ModelAsset url="/assets/kenney/city/building-type-b.glb" position={[-0.88, 0, 0.12]} rotation={[0, 0.15, 0]} scale={1.18} />
      <ModelAsset url="/assets/kenney/city/building-type-l.glb" position={[1.08, 0, 0.18]} rotation={[0, -0.18, 0]} scale={0.92} />
      <ModelAsset url="/assets/kenney/city/tree-large.glb" position={[0.26, 0, -0.88]} scale={1.16} />
      <ModelAsset url="/assets/kenney/city/tree-small.glb" position={[-0.2, 0, -0.82]} scale={1.04} />
    </group>
  );
}

function Pawn({
  token,
  geometryId,
  palette,
  moving,
  currentStep,
  stackIndex,
}: {
  token: WebGlToken;
  geometryId: BoardGeometryId;
  palette: Palette;
  moving: boolean;
  currentStep: number | null;
  stackIndex: number;
}) {
  const group = useRef<Group>(null);
  const target = useMemo(
    () => tilePosition(geometryId, moving && currentStep !== null ? currentStep : token.position),
    [currentStep, geometryId, moving, token.position],
  );
  const seatOffset = useMemo(() => {
    const inward = new Vector3(-target.x, 0, -target.z);
    if (inward.lengthSq() > 0.01) inward.normalize().multiplyScalar(0.24);
    return inward.add(new Vector3((stackIndex % 2) * 0.2 - 0.1, 0.34, Math.floor(stackIndex / 2) * 0.18 - 0.09));
  }, [stackIndex, target]);
  const from = useRef(target.clone());
  const to = useRef(target.clone());
  const progress = useRef(1);

  useEffect(() => {
    if (!group.current) return;
    from.current.copy(group.current.position);
    to.current.copy(target).add(seatOffset);
    progress.current = 0;
  }, [seatOffset, target]);

  useFrame((_, delta) => {
    if (!group.current) return;
    progress.current = Math.min(1, progress.current + delta / 0.55);
    const eased = 1 - Math.pow(1 - progress.current, 3);
    group.current.position.lerpVectors(from.current, to.current, eased);
    group.current.position.y += Math.sin(progress.current * Math.PI) * (moving ? 0.82 : 0.18);
    group.current.rotation.y += moving ? delta * 4.2 : delta * 0.35;
  });

  const color = palette.pawn[token.symbol];
  return (
    <group ref={group} position={target.clone().add(seatOffset)}>
      {token.active ? (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.47, 32]} />
          <meshStandardMaterial color={palette.bonus} emissive={palette.coral} emissiveIntensity={0.16} />
        </mesh>
      ) : null}
      <mesh position={[0, 0.13, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.42, 0.24, 24]} />
        <meshStandardMaterial color={palette.boardDeep} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.27, 0]} castShadow>
        <cylinderGeometry args={[0.29, 0.32, 0.08, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <ModelAsset url={PLAYER_MODELS[token.symbol]} position={[0, 0.25, 0]} rotation={[0, Math.PI, 0]} scale={0.34} />
      {token.active || moving ? <PawnLabel label={token.label} active={Boolean(token.active)} palette={palette} /> : null}
    </group>
  );
}

function BoardScene({
  geometryId,
  skinId,
  tokens,
  tileTypes,
  currentStep,
  landedIndex,
  movingTokenId,
  palette,
}: Pick<WebGLGameBoardProps, "geometryId" | "skinId" | "tokens" | "tileTypes" | "currentStep" | "landedIndex" | "movingTokenId"> & { palette: Palette }) {
  const geometry = boardGeometries[geometryId];
  const boardWidth = geometry.columns * TILE_STEP + 0.92;
  const boardDepth = geometry.rows * TILE_STEP + 0.92;
  const terrainColor = skinId === "SPACE_LAB" ? palette.event : skinId === "ECO_EXPEDITION" ? palette.rest : palette.terrain;
  const floorColor = skinId === "SPACE_LAB" ? palette.boardDeep : skinId === "ECO_EXPEDITION" ? palette.terrainDeep : palette.cream;

  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, 22, 62]} />
      <hemisphereLight args={[palette.surface, palette.boardDeep, 1.6]} />
      <directionalLight
        castShadow
        color={palette.surface}
        intensity={3.05}
        position={[9, 14, 10]}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
      />
      <mesh position={[0, -0.7, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color={floorColor} roughness={0.92} />
      </mesh>
      <group>
        <RoundedBox args={[boardWidth + 1.5, 0.42, boardDepth + 1.5]} radius={0.34} smoothness={4} position={[0, -0.42, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={palette.cream} roughness={0.7} />
        </RoundedBox>
        <RoundedBox args={[boardWidth, 0.76, boardDepth]} radius={0.28} smoothness={4} position={[0, -0.04, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={palette.boardDeep} roughness={0.58} />
        </RoundedBox>
        <RoundedBox args={[boardWidth - 0.24, 0.4, boardDepth - 0.24]} radius={0.22} smoothness={4} position={[0, 0.42, 0]} receiveShadow>
          <meshStandardMaterial color={palette.board} roughness={0.52} />
        </RoundedBox>
        <RoundedBox args={[boardWidth - 0.72, 0.18, boardDepth - 0.72]} radius={0.18} smoothness={3} position={[0, 0.68, 0]} receiveShadow>
          <meshStandardMaterial color={terrainColor} roughness={0.78} />
        </RoundedBox>
        <RoundedBox args={[Math.min(5.8, boardWidth - 0.8), 0.42, 0.56]} radius={0.18} smoothness={3} position={[0, -0.06, boardDepth / 2 + 0.58]} castShadow>
          <meshStandardMaterial color={palette.boardDeep} roughness={0.5} />
        </RoundedBox>
        {[-1, 0, 1].map((offset) => (
          <mesh key={offset} position={[offset * 0.45, 0.17, boardDepth / 2 + 0.58]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.1, 24]} />
            <meshStandardMaterial color={offset === 0 ? palette.coral : palette.bonus} roughness={0.34} />
          </mesh>
        ))}
        {geometry.tiles.map((baseTile) => {
          const type = tileTypes?.[baseTile.index] ?? baseTile.type;
          return (
            <TileBlock
              key={baseTile.index}
              geometryId={geometryId}
              index={baseTile.index}
              type={type}
              label={tileTypeLabels[type]}
              palette={palette}
              current={currentStep === baseTile.index}
              landed={landedIndex === baseTile.index}
            />
          );
        })}
        <ThemeLandmarks geometryId={geometryId} skinId={skinId} boardDepth={boardDepth} />
        {tokens.map((token, index) => (
          <Pawn
            key={token.id}
            token={token}
            geometryId={geometryId}
            palette={palette}
            moving={movingTokenId === token.id}
            currentStep={currentStep}
            stackIndex={index}
          />
        ))}
      </group>
      <ContactShadows position={[0, -0.68, 0]} opacity={0.3} scale={Math.max(boardWidth, boardDepth) * 1.35} blur={2.4} far={22} frames={1} color={palette.ink} />
      <BoardCamera geometryId={geometryId} />
    </>
  );
}

const pipLayout: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function PipFace({ value, side, palette }: { value: number; side: "top" | "bottom" | "front" | "back" | "left" | "right"; palette: Palette }) {
  return pipLayout[value].map(([column, row], index) => {
    const a = column * 0.22;
    const b = row * 0.22;
    const configuration = {
      top: { position: [a, 0.515, b], rotation: [0, 0, 0] },
      bottom: { position: [a, -0.515, -b], rotation: [0, 0, 0] },
      front: { position: [a, -b, 0.515], rotation: [Math.PI / 2, 0, 0] },
      back: { position: [-a, -b, -0.515], rotation: [Math.PI / 2, 0, 0] },
      right: { position: [0.515, -b, -a], rotation: [0, 0, Math.PI / 2] },
      left: { position: [-0.515, -b, a], rotation: [0, 0, Math.PI / 2] },
    }[side];
    return (
      <mesh key={`${side}-${index}`} position={configuration.position as [number, number, number]} rotation={configuration.rotation as [number, number, number]}>
        <cylinderGeometry args={[0.075, 0.075, 0.035, 18]} />
        <meshStandardMaterial color={value === 1 ? palette.coral : palette.pip} roughness={0.36} />
      </mesh>
    );
  });
}

function resultQuaternion(value: number) {
  const quaternion = new Quaternion();
  if (value === 2) quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  if (value === 3) quaternion.setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
  if (value === 4) quaternion.setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2);
  if (value === 5) quaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
  if (value === 6) quaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
  return quaternion;
}

function PhysicsDie({ value, phase, rollCycle, reducedMotion, palette }: { value: number; phase: "rolling" | "result"; rollCycle: number; reducedMotion: boolean; palette: Palette }) {
  const rigidBody = useRef<RapierRigidBody>(null);
  const { rapier } = useRapier();
  const settleProgress = useRef(1);
  const settleFromPosition = useRef(new Vector3());
  const settleFromRotation = useRef(new Quaternion());
  const settleTargetRotation = useMemo(() => resultQuaternion(value), [value]);

  useEffect(() => {
    const body = rigidBody.current;
    if (!body) return;
    body.setBodyType(rapier.RigidBodyType.Dynamic, true);
    body.setTranslation({ x: -1.8, y: reducedMotion ? 2.8 : 4.4, z: 0.3 }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.setLinvel({ x: reducedMotion ? 2.7 : 4.8, y: reducedMotion ? 0.4 : 1.6, z: -0.45 }, true);
    body.setAngvel({ x: reducedMotion ? 7 : 15, y: reducedMotion ? 8 : 18, z: reducedMotion ? 6 : 13 }, true);
    settleProgress.current = 0;
  }, [rapier.RigidBodyType.Dynamic, reducedMotion, rollCycle]);

  useEffect(() => {
    if (phase !== "result" || !rigidBody.current) return;
    const body = rigidBody.current;
    const position = body.translation();
    const rotation = body.rotation();
    settleFromPosition.current.set(position.x, position.y, position.z);
    settleFromRotation.current.set(rotation.x, rotation.y, rotation.z, rotation.w);
    settleProgress.current = 0;
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
  }, [phase, rapier.RigidBodyType.KinematicPositionBased, settleTargetRotation]);

  useFrame((_, delta) => {
    const body = rigidBody.current;
    if (!body || phase !== "result" || settleProgress.current >= 1) return;
    settleProgress.current = Math.min(1, settleProgress.current + delta / (reducedMotion ? 0.18 : 0.48));
    const progress = 1 - Math.pow(1 - settleProgress.current, 3);
    const position = settleFromPosition.current.clone().lerp(new Vector3(0, 0.78, 0), progress);
    const rotation = settleFromRotation.current.clone().slerp(settleTargetRotation, progress);
    body.setNextKinematicTranslation(position);
    body.setNextKinematicRotation(rotation);
  });

  return (
    <RigidBody ref={rigidBody} colliders="cuboid" restitution={0.66} friction={0.72} linearDamping={0.24} angularDamping={0.18} canSleep={false}>
      <group>
        <RoundedBox args={[1, 1, 1]} radius={0.16} smoothness={5} castShadow receiveShadow>
          <meshStandardMaterial color={palette.cream} roughness={0.38} metalness={0.02} />
        </RoundedBox>
        <PipFace value={1} side="top" palette={palette} />
        <PipFace value={6} side="bottom" palette={palette} />
        <PipFace value={2} side="front" palette={palette} />
        <PipFace value={5} side="back" palette={palette} />
        <PipFace value={3} side="right" palette={palette} />
        <PipFace value={4} side="left" palette={palette} />
      </group>
    </RigidBody>
  );
}

function DiceScene({ value, phase, rollCycle, reducedMotion, palette }: { value: number; phase: "rolling" | "result"; rollCycle: number; reducedMotion: boolean; palette: Palette }) {
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <ambientLight intensity={1.4} />
      <directionalLight castShadow position={[4, 7, 6]} intensity={3.8} color={palette.surface} shadow-mapSize={[512, 512]} />
      <Physics gravity={[0, -13, 0]} timeStep="vary">
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[3.6, 0.1, 2.5]} position={[0, 0, 0]} restitution={0.56} friction={0.8} />
          <CuboidCollider args={[0.1, 2, 2.5]} position={[-3.6, 1.5, 0]} />
          <CuboidCollider args={[0.1, 2, 2.5]} position={[3.6, 1.5, 0]} />
          <CuboidCollider args={[3.6, 2, 0.1]} position={[0, 1.5, -2.5]} />
          <CuboidCollider args={[3.6, 2, 0.1]} position={[0, 1.5, 2.5]} />
          <RoundedBox args={[7.2, 0.2, 5]} radius={0.16} smoothness={3} position={[0, -0.12, 0]} receiveShadow>
            <meshStandardMaterial color={palette.bonus} roughness={0.72} />
          </RoundedBox>
        </RigidBody>
        <PhysicsDie value={value} phase={phase} rollCycle={rollCycle} reducedMotion={reducedMotion} palette={palette} />
      </Physics>
      <ContactShadows position={[0, 0.02, 0]} opacity={0.36} scale={6} blur={2.5} far={5} frames={1} color={palette.ink} />
    </>
  );
}

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function BoardFallback() {
  return (
    <div className="webgl-board-fallback" role="status">
      <strong>이 기기에서는 3D 보드를 열 수 없습니다.</strong>
      <span>상단의 2D 평면 보드로 전환해 게임을 계속할 수 있습니다.</span>
    </div>
  );
}

export function WebGLGameBoard(props: WebGLGameBoardProps) {
  const palette = usePalette();
  const geometry = boardGeometries[props.geometryId];
  const wide = props.geometryId === "RACE_24" || props.geometryId === "LINE_24";
  const boardDescription = `${skinNames[props.skinId]} ${geometry.name} WebGL 보드. ${props.currentTurnLabel} 차례, ${props.eventLabel}`;
  const landedType = props.landedIndex === null ? null : props.tileTypes?.[props.landedIndex] ?? geometry.tiles[props.landedIndex].type;
  const stageState = props.rolling ? "rolling" : props.movingTokenId ? "moving" : landedType ? "arrived" : "idle";
  const stageTitle = props.rolling
    ? props.rollPhase === "result" ? `주사위 결과 ${props.lastRoll}` : "주사위를 굴리는 중"
    : props.movingTokenId
      ? `${props.currentStep !== null ? props.currentStep + 1 : "다음"}번 칸으로 이동 중`
      : `${props.currentTurnLabel} 차례`;
  const stageDetail = landedType ? `${tileTypeLabels[landedType]} 칸 도착` : props.eventLabel;

  if (!palette) {
    return <div className="webgl-board-loading" role="status"><span />3D 보드를 준비하고 있습니다.</div>;
  }

  const canvas = (
    <div className={`webgl-board-shell${wide ? " webgl-board-shell--wide" : ""}${props.geometryId === "LINE_24" ? " webgl-board-shell--line" : ""}`} role="img" aria-label={boardDescription}>
      <Canvas
        aria-hidden="true"
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: 36, position: [8, 10, 12] }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        fallback={<BoardFallback />}
      >
        <BoardScene
          geometryId={props.geometryId}
          skinId={props.skinId}
          tokens={props.tokens}
          tileTypes={props.tileTypes}
          currentStep={props.currentStep}
          landedIndex={props.landedIndex}
          movingTokenId={props.movingTokenId}
          palette={palette}
        />
      </Canvas>
      <div className="webgl-game-hud" aria-hidden="true">
        <div className="webgl-game-hud__status" data-state={stageState}>
          <span className="mono-label">ROUND {props.round}</span>
          <strong>{stageTitle}</strong>
          <span>{stageDetail}</span>
        </div>
        <div className="webgl-game-hud__view">
          <span className="mono-label">3D TABLETOP</span>
          <span>드래그 · 회전 · 확대</span>
        </div>
      </div>
      {props.controls ? <div className="webgl-game-hud__controls">{props.controls}</div> : null}
    </div>
  );

  return (
    <WebGLErrorBoundary fallback={<BoardFallback />}>
      <div className="webgl-board-wrap">
        {canvas}
        {props.rolling ? (
          <div className="webgl-dice-overlay" role="status" aria-label={props.rollPhase === "result" ? `주사위 결과 ${props.lastRoll}` : "주사위를 굴리는 중"} data-phase={props.rollPhase}>
            <div className="webgl-dice-canvas">
              <Canvas aria-hidden="true" shadows dpr={[1, 1.5]} camera={{ fov: 33, position: [4.6, 3.8, 6.4] }} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}>
                <DiceScene value={props.lastRoll} phase={props.rollPhase} rollCycle={props.rollCycle} reducedMotion={props.reducedMotion} palette={palette} />
              </Canvas>
            </div>
            <strong>{props.rollPhase === "result" ? <>주사위 결과 <b>{props.lastRoll}</b></> : "주사위가 굴러갑니다"}</strong>
          </div>
        ) : null}
      </div>
    </WebGLErrorBoundary>
  );
}
