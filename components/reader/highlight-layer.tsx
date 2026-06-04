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
        const hasNote = Boolean(highlight.note.trim());

        return (anchor?.rects ?? []).map((rect, index) => (
          <motion.button
            aria-label={`Open highlight: ${highlight.selected_text}`}
            className={`asneb-pdf-highlight pointer-events-auto absolute ${color.overlay} ${
              focusedHighlightId === highlight.id
                ? "asneb-pdf-highlight-focused"
                : ""
            }`}
            data-has-note={hasNote}
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
            className="asneb-note-anchor pointer-events-auto absolute z-30 flex h-6 w-6 items-center justify-center rounded-full text-slate-950 transition"
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
