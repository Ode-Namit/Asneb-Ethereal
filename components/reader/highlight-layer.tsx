"use client";

import { motion } from "framer-motion";
import { MessageSquareText } from "lucide-react";
import { getHighlightColor, parsePdfAnchor } from "@/lib/research";
import type { HighlightRecord, NoteRecord } from "@/lib/types";

export function HighlightLayer({
  focusedHighlightId,
  highlights,
  notes,
  onSelectHighlight,
}: {
  focusedHighlightId: string | null;
  highlights: HighlightRecord[];
  notes: NoteRecord[];
  onSelectHighlight: (highlightId: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {highlights.flatMap((highlight) => {
        const anchor = parsePdfAnchor(highlight.anchor_json);
        const color = getHighlightColor(highlight.color);

        return (anchor?.rects ?? []).map((rect, index) => (
          <motion.button
            aria-label={`Open highlight: ${highlight.selected_text}`}
            className={`pointer-events-auto absolute rounded-[2px] border transition hover:brightness-125 ${color.overlay} ${
              focusedHighlightId === highlight.id
                ? "animate-pulse-glow shadow-[0_0_22px_rgba(0,212,255,0.62)]"
                : ""
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key={`${highlight.id}-${index}`}
            onClick={() => onSelectHighlight(highlight.id)}
            style={{
              height: `${rect.height * 100}%`,
              left: `${rect.left * 100}%`,
              top: `${rect.top * 100}%`,
              width: `${rect.width * 100}%`,
            }}
            type="button"
          />
        ));
      })}
      {notes.map((note) => {
        const rect = parsePdfAnchor(note.anchor_json)?.rects[0];
        if (!rect) {
          return null;
        }

        return (
          <button
            aria-label={`Open ${note.kind} note`}
            className="pointer-events-auto absolute z-30 flex h-5 w-5 items-center justify-center rounded-full border border-amber-100/60 bg-amber-300 text-slate-950 shadow-[0_0_16px_rgba(252,211,77,0.55)] transition hover:scale-110"
            key={note.id}
            style={{
              left: `${Math.min(0.98, rect.left + rect.width) * 100}%`,
              top: `${Math.max(0, rect.top - 0.012) * 100}%`,
            }}
            title={note.content}
            type="button"
          >
            <MessageSquareText className="h-3 w-3" />
          </button>
        );
      })}
    </div>
  );
}
