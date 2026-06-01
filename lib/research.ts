import type { HighlightColor, PdfAnchor } from "@/lib/types";

export const highlightColors: Array<{
  color: HighlightColor;
  label: string;
  overlay: string;
  solid: string;
}> = [
  {
    color: "cyan",
    label: "Photon cyan",
    overlay: "bg-cyan-300/35 border-cyan-100/55",
    solid: "bg-cyan-300",
  },
  {
    color: "violet",
    label: "Quantum violet",
    overlay: "bg-violet-400/35 border-violet-200/55",
    solid: "bg-violet-400",
  },
  {
    color: "amber",
    label: "Solar amber",
    overlay: "bg-amber-300/40 border-amber-100/55",
    solid: "bg-amber-300",
  },
  {
    color: "emerald",
    label: "Field emerald",
    overlay: "bg-emerald-300/35 border-emerald-100/55",
    solid: "bg-emerald-300",
  },
  {
    color: "rose",
    label: "Spectral rose",
    overlay: "bg-rose-300/35 border-rose-100/55",
    solid: "bg-rose-300",
  },
];

export function getHighlightColor(color: HighlightColor) {
  return (
    highlightColors.find((item) => item.color === color) ?? highlightColors[0]
  );
}

export function parsePdfAnchor(anchorJson: string): PdfAnchor | null {
  try {
    const anchor = JSON.parse(anchorJson) as Partial<PdfAnchor>;

    if (
      !Array.isArray(anchor.rects) ||
      typeof anchor.start !== "number" ||
      typeof anchor.end !== "number"
    ) {
      return null;
    }

    return anchor as PdfAnchor;
  } catch {
    return null;
  }
}

export function formatResearchDate(value: string) {
  if (!value) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
