"use client";

import type { CSSProperties } from "react";

const pips: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const landingRotation: Record<number, string> = {
  1: "rotateX(0deg) rotateY(0deg) rotateZ(0deg)",
  2: "rotateX(-90deg) rotateY(0deg) rotateZ(0deg)",
  3: "rotateX(0deg) rotateY(90deg) rotateZ(0deg)",
  4: "rotateX(0deg) rotateY(-90deg) rotateZ(0deg)",
  5: "rotateX(90deg) rotateY(0deg) rotateZ(0deg)",
  6: "rotateX(0deg) rotateY(180deg) rotateZ(0deg)",
};

function Face({ value, side }: { value: number; side: string }) {
  const visible = new Set(pips[value]);
  return (
    <span className={`physics-die__face physics-die__face--${side} physics-die__face--value-${value}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <i key={index} className={visible.has(index + 1) ? "is-visible" : ""} />
      ))}
    </span>
  );
}

export function PhysicsDie({ value, rollKey }: { value: number; rollKey: number }) {
  const style = {
    "--die-final": landingRotation[value] ?? landingRotation[1],
    "--die-tilt": `${(rollKey % 2 ? 1 : -1) * 18}deg`,
  } as CSSProperties;

  return (
    <div className="physics-die-stage" aria-hidden="true">
      <span className="physics-die-stage__floor" />
      <span className="physics-die-stage__shadow" />
      <span className="physics-die-stage__burst">
        {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
      </span>
      <span key={rollKey} className="physics-die" style={style}>
        <Face value={1} side="front" />
        <Face value={2} side="top" />
        <Face value={3} side="left" />
        <Face value={4} side="right" />
        <Face value={5} side="bottom" />
        <Face value={6} side="back" />
      </span>
    </div>
  );
}
