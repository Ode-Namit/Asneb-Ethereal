import type { ReactNode } from "react";
import { Activity, Orbit, RadioTower } from "lucide-react";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { Brand } from "@/components/ui/brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <AmbientBackground />
      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700/30 bg-slate-950/50 shadow-[0_32px_100px_rgba(0,0,0,0.52)] backdrop-blur-2xl lg:grid-cols-[1.12fr_0.88fr]">
        <section className="relative hidden min-h-[660px] overflow-hidden border-r border-slate-700/30 p-10 lg:block">
          <div className="absolute -left-20 top-36 h-80 w-80 rounded-full border border-cyan-400/20" />
          <div className="absolute -left-10 top-[184px] h-60 w-60 animate-spin-slow rounded-full border border-dashed border-violet-400/25" />
          <div className="absolute left-[86px] top-[284px] h-16 w-16 rounded-full border border-cyan-300/40 bg-cyan-400/[0.05] shadow-neon" />
          <div className="absolute -bottom-36 -right-28 h-[360px] w-[360px] rounded-full bg-violet-500/[0.08] blur-3xl" />
          <Brand />
          <div className="relative mt-40 max-w-md">
            <div className="hud-label mb-5">Research Node // 01</div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white">
              A private observatory for{" "}
              <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">
                difficult ideas.
              </span>
            </h1>
            <p className="mt-6 max-w-sm text-sm leading-7 text-slate-400">
              Read deeply. Isolate a theorem. Deconstruct a derivation. Keep your
              physics library and your thinking in one quiet instrument.
            </p>
          </div>
          <div className="absolute bottom-9 left-10 right-10 grid grid-cols-3 gap-3">
            {[
              { icon: Orbit, label: "ORBIT", value: "Stable" },
              { icon: Activity, label: "SIGNAL", value: "Nominal" },
              { icon: RadioTower, label: "LINK", value: "Private" },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={String(label)}
                className="rounded-lg border border-slate-700/35 bg-slate-950/30 p-3"
              >
                <Icon className="h-4 w-4 text-cyan-300/80" />
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
