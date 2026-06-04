"use client";

import { ArrowDownAZ, ChevronDown } from "lucide-react";
import { sortOptions, type SortOption } from "@/lib/sorting";

export function SortSelect({
  label = "Sort",
  onChange,
  value,
}: {
  label?: string;
  onChange: (value: SortOption) => void;
  value: SortOption;
}) {
  return (
    <label className="group relative inline-flex min-w-[152px] items-center gap-2 rounded-lg border border-cyan-200/20 bg-slate-950/70 px-3 py-2 text-xs text-cyan-50 shadow-[0_0_24px_rgba(103,232,249,0.08)] transition hover:border-cyan-200/45 hover:bg-slate-900/85 hover:text-white focus-within:border-aureate/55 focus-within:bg-slate-950/90 focus-within:text-white">
      <ArrowDownAZ className="h-3.5 w-3.5 shrink-0 text-cyan-200 transition group-hover:text-aureate" />
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="w-full appearance-none bg-transparent pr-5 text-[0.68rem] font-semibold uppercase tracking-wider text-cyan-50 outline-none"
        onChange={(event) => onChange(event.target.value as SortOption)}
        value={value}
      >
        {sortOptions.map((option) => (
          <option
            className="bg-slate-950 text-cyan-50 checked:bg-cyan-950 checked:text-aureate"
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-cyan-200/80 transition group-hover:text-aureate" />
    </label>
  );
}
