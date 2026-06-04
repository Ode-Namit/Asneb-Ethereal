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
    <label className="group relative inline-flex min-w-[152px] items-center gap-2 rounded-lg border border-pearl/10 bg-slate-950/35 px-3 py-2 text-xs text-slate-400 shadow-[0_0_24px_rgba(103,232,249,0.04)] transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.055] hover:text-cyan-100 focus-within:border-cyan-300/45 focus-within:text-cyan-100">
      <ArrowDownAZ className="h-3.5 w-3.5 shrink-0 text-cyan-300/70 transition group-hover:text-cyan-200" />
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="w-full appearance-none bg-transparent pr-5 text-[0.68rem] font-semibold uppercase tracking-wider outline-none"
        onChange={(event) => onChange(event.target.value as SortOption)}
        value={value}
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-600 transition group-hover:text-cyan-200" />
    </label>
  );
}
