import type { HighlightColor, PdfAnchor } from "@/lib/types";

export const highlightColors: Array<{
  color: HighlightColor;
  label: string;
  overlay: string;
  ring: string;
  soft: string;
  solid: string;
  text: string;
}> = [
  {
    color: "cyan",
    label: "Photon cyan",
    overlay: "asneb-highlight-cyan",
    ring: "border-cyan-300/55",
    soft: "bg-cyan-400/[0.075]",
    solid: "bg-cyan-300",
    text: "text-cyan-100",
  },
  {
    color: "violet",
    label: "Quantum violet",
    overlay: "asneb-highlight-violet",
    ring: "border-violet-300/55",
    soft: "bg-violet-400/[0.075]",
    solid: "bg-violet-400",
    text: "text-violet-100",
  },
  {
    color: "amber",
    label: "Solar amber",
    overlay: "asneb-highlight-amber",
    ring: "border-amber-300/60",
    soft: "bg-amber-300/[0.08]",
    solid: "bg-amber-300",
    text: "text-amber-100",
  },
  {
    color: "emerald",
    label: "Field emerald",
    overlay: "asneb-highlight-emerald",
    ring: "border-emerald-300/55",
    soft: "bg-emerald-400/[0.075]",
    solid: "bg-emerald-300",
    text: "text-emerald-100",
  },
  {
    color: "rose",
    label: "Spectral rose",
    overlay: "asneb-highlight-rose",
    ring: "border-rose-300/55",
    soft: "bg-rose-400/[0.075]",
    solid: "bg-rose-300",
    text: "text-rose-100",
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
