import type { ReactNode } from "react";
import { BookOpen, Moon, Sparkles } from "lucide-react";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { Brand } from "@/components/ui/brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="spatial-root relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <AmbientBackground />
      <div className="floating-glass spatial-layer cinematic-reveal relative z-10 grid w-full max-w-5xl overflow-hidden rounded-2xl border border-pearl/15 lg:grid-cols-[1.12fr_0.88fr]">
        <section className="relative hidden min-h-[660px] overflow-hidden border-r border-pearl/10 p-10 lg:block">
          <div className="absolute -left-24 top-28 h-96 w-96 rounded-full border border-aureate/15 bg-pearl/[0.03] blur-[1px]" />
          <div className="absolute -left-6 top-[184px] h-64 w-64 animate-spin-slow rounded-full border border-dashed border-aurora/25" />
          <div className="absolute left-[98px] top-[284px] h-16 w-16 rounded-full border border-aureate/40 bg-aureate/[0.07] shadow-halo" />
          <div className="absolute -bottom-36 -right-28 h-[360px] w-[360px] rounded-full bg-aurora/[0.1] blur-3xl" />
          <Brand />
          <div className="relative mt-40 max-w-md">
            <div className="hud-label mb-5">Memory Sanctuary // 01</div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white">
              A floating archive for{" "}
              <span className="bg-gradient-to-r from-aureate via-aurora to-photon bg-clip-text text-transparent">
                luminous reading.
              </span>
            </h1>
            <p className="mt-6 max-w-sm text-sm leading-7 text-slate-400">
              Read deeply, gather memory fragments, and let a reflective
              companion help difficult ideas become clear.
            </p>
          </div>
          <div className="absolute bottom-9 left-10 right-10 grid grid-cols-3 gap-3">
            {[
              { icon: Moon, label: "CALM", value: "Soft" },
              { icon: BookOpen, label: "PAGES", value: "Awake" },
              { icon: Sparkles, label: "MEMORY", value: "Private" },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={String(label)}
                className="spatial-panel rounded-lg border border-pearl/10 bg-pearl/[0.04] p-3"
              >
                <Icon className="h-4 w-4 text-aureate/80" />
                <div className="hud-label mt-4 text-[0.5rem]">{label}</div>
                <div className="mt-1 text-xs text-slate-300">{value}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="flex min-h-[610px] items-center p-6 sm:p-10 lg:p-12">
          <div className="w-full">
            <div className="mb-12 lg:hidden">
              <Brand />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
