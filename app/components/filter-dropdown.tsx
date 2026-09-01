"use client";
import "../studio.css";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FilterOptionGroup = {
  group: string;
  options: { value: string; label: string }[];
};

export function FilterDropdown({
  label,
  icon: Icon,
  value,
  options,
  onSelect,
  align = "start",
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  options: FilterOptionGroup[];
  onSelect: (value: string) => void;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLButtonElement[]>([]);
  const flatOptions = options.flatMap((group) => group.options);
  const isActive = value !== "전체";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("[data-filter-trigger]")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function moveFocus(direction: 1 | -1) {
    const next = direction === 1 ? activeIndex + 1 : activeIndex - 1;
    const clamped = next < 0 ? flatOptions.length - 1 : next >= flatOptions.length ? 0 : next;
    setActiveIndex(clamped);
    itemsRef.current[clamped]?.focus();
  }

  function select(valueToSelect: string) {
    onSelect(valueToSelect);
    setOpen(false);
    setActiveIndex(-1);
    rootRef.current?.querySelector<HTMLButtonElement>("[data-filter-trigger]")?.focus();
  }

  return (
    <div className={`filter-dropdown${isActive ? " is-active" : ""}`} ref={rootRef}>
      <button
        type="button"
        data-filter-trigger
        className="filter-dropdown__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            moveFocus(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            moveFocus(-1);
          }
        }}
      >
        <Icon aria-hidden="true" />
        <span>{isActive ? value : label}</span>
        <ChevronDown aria-hidden="true" className="filter-dropdown__chevron" />
      </button>
      {open && (
        <div className={`filter-popover filter-popover--${align}`} role="listbox" aria-label={label} ref={listRef}>
          {options.map((group, groupIndex) => (
            <div className="filter-popover__group" key={group.group}>
              <span className="filter-popover__group-label">{group.group}</span>
              {group.options.map((option, optionIndex) => {
                const flatIndex = options.slice(0, groupIndex).reduce((sum, g) => sum + g.options.length, 0) + optionIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={value === option.value}
                    className={`filter-popover__option${value === option.value ? " is-selected" : ""}`}
                    ref={(element) => {
                      itemsRef.current[flatIndex] = element as HTMLButtonElement;
                    }}
                    onClick={() => select(option.value)}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                  >
                    <Check aria-hidden="true" className="filter-popover__check" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
