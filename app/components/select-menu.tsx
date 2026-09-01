"use client";
import "../studio.css";

import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FilterDropdown } from "./filter-dropdown";

// FilterDropdown(스타일드 팝오버)을 폼 필드용으로 감싼 단순 select.
// native <select>와 달리 클릭 시 뜨는 메뉴까지 디자인 토큰이 적용된다.
export function SelectMenu({
  label,
  icon: Icon,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="select-menu">
        <div className="filter-dropdown__trigger is-disabled" aria-disabled="true">
          <Icon aria-hidden="true" />
          <span>{options.find((option) => option.value === value)?.label ?? value}</span>
          <ChevronDown aria-hidden="true" className="filter-dropdown__chevron" />
        </div>
      </div>
    );
  }

  const currentLabel = options.find((option) => option.value === value)?.label ?? value;
  return (
    <div className="select-menu">
      <FilterDropdown
        label={label}
        icon={Icon}
        value={currentLabel}
        onSelect={(selectedLabel) => {
          const option = options.find((candidate) => candidate.label === selectedLabel);
          if (option) onChange(option.value);
        }}
        options={[{ group: "", options: options.map((option) => ({ value: option.label, label: option.label })) }]}
      />
    </div>
  );
}
