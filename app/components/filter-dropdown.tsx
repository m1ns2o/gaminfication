"use client";
import "../studio.css";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  // 팝오버는 포탈(body/dialog)로 띄우므로, 트리거의 화면 좌표를 고정 앵커로 기억한다.
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLButtonElement[]>([]);
  const flatOptions = options.flatMap((group) => group.options);
  const isActive = value !== "전체";

  function measureTrigger() {
    const trigger = rootRef.current?.querySelector<HTMLButtonElement>("[data-filter-trigger]");
    if (!trigger) return false;
    const rect = trigger.getBoundingClientRect();
    setAnchor({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    return true;
  }

  function openDropdown() {
    // 팝오버를 렌더링 중이 아닌 이벤트에서 포탈 호스트(가까운 dialog 혹은 body)를 확정한다.
    setPortalHost(rootRef.current?.closest("dialog") ?? document.body);
    if (measureTrigger()) setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const insideRoot = rootRef.current?.contains(target);
      const insideList = listRef.current?.contains(target);
      if (!insideRoot && !insideList) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("[data-filter-trigger]")?.focus();
      }
    }
    function updateAnchor() {
      measureTrigger();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateAnchor);
    // 고정(fixed) 앵커이므로 스크롤 시 트리거 위치를 따라가며 갱신한다.
    document.addEventListener("scroll", updateAnchor, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateAnchor);
      document.removeEventListener("scroll", updateAnchor, true);
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
    <div className={`filter-dropdown${isActive ? " is-active" : ""}`} ref={rootRef} data-open={open}>
      <button
        type="button"
        data-filter-trigger
        className="filter-dropdown__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openDropdown())}
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
      {open && anchor && portalHost && createPortal(
        <div
          className="filter-popover-anchor"
          style={{ left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height }}
        >
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
        </div>,
        portalHost,
      )}
    </div>
  );
}
