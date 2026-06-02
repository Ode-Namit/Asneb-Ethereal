import { Sparkles } from "lucide-react";

export function Brand({ condensed = false }: { condensed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-aureate/30 bg-pearl/[0.08] shadow-halo">
        <div className="absolute inset-1 rounded-lg border border-photon/20" />
        <Sparkles className="relative h-5 w-5 text-aureate" strokeWidth={1.45} />
      </div>
      {!condensed && (
        <div>
          <div className="text-sm font-bold tracking-[0.22em] text-white">
            ASNEB
          </div>
          <div className="hud-label mt-0.5 text-[0.52rem] text-aureate/75">
            Ethereal Reading OS
          </div>
        </div>
      )}
    </div>
  );
}
