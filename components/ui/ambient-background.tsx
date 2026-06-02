"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { PremiumCursor } from "@/components/ui/premium-cursor";

const CelestialScene = dynamic(
  () => import("@/components/ui/celestial-scene").then((module) => module.CelestialScene),
  { ssr: false },
);

const stars = Array.from({ length: 52 }, (_, index) => ({
  id: index,
  left: `${(index * 37 + 11) % 100}%`,
  top: `${(index * 61 + 7) % 100}%`,
  delay: (index % 8) * 0.42,
  size: index % 9 === 0 ? 2 : 1,
}));

export function AmbientBackground({ compact = false }: { compact?: boolean }) {
  useEffect(() => {
    const handlePointer = (event: PointerEvent) => {
      document.documentElement.style.setProperty(
        "--asneb-cursor-x",
        String((event.clientX / window.innerWidth - 0.5) * 2),
      );
      document.documentElement.style.setProperty(
        "--asneb-cursor-y",
        String((event.clientY / window.innerHeight - 0.5) * 2),
      );
    };
    const handleScroll = () => {
      document.documentElement.style.setProperty(
        "--asneb-scroll",
        String(
          window.scrollY /
            Math.max(1, document.body.scrollHeight - window.innerHeight),
        ),
      );
    };

    window.addEventListener("pointermove", handlePointer, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-space">
      <PremiumCursor />
      <div className="absolute inset-0 opacity-80">
        <CelestialScene compact={compact} />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(255,250,240,0.2),transparent_22%),radial-gradient(circle_at_82%_6%,rgba(185,156,255,0.2),transparent_25%),radial-gradient(circle_at_56%_95%,rgba(139,233,255,0.12),transparent_30%),linear-gradient(180deg,rgba(10,11,24,0.18),rgba(7,7,18,0.88))]" />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,rgba(246,215,138,0.12),transparent)] blur-3xl" />
      <div className="absolute inset-0 opacity-[0.11] [background-image:linear-gradient(rgba(255,250,240,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,250,240,0.12)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(185,156,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(139,233,255,0.18)_1px,transparent_1px)] [background-size:240px_240px]" />
      <motion.div
        className="absolute left-[8%] top-[16%] h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,rgba(255,250,240,0.12),rgba(246,215,138,0.06)_34%,transparent_66%)] blur-2xl"
        animate={{ y: compact ? [0, -10, 0] : [0, -24, 0], opacity: [0.55, 0.82, 0.55] }}
        transition={{ duration: compact ? 12 : 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-12%] top-[24%] h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle,rgba(248,184,217,0.12),rgba(139,233,255,0.06)_38%,transparent_70%)] blur-2xl"
        animate={{ y: compact ? [0, 8, 0] : [0, 18, 0], x: [0, -10, 0] }}
        transition={{ duration: compact ? 14 : 21, repeat: Infinity, ease: "easeInOut" }}
      />
      {stars.map((star) => (
        <motion.span
          key={star.id}
          className="absolute rounded-full bg-pearl shadow-[0_0_12px_rgba(255,250,240,0.9)]"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
          }}
          animate={{ opacity: [0.14, 0.86, 0.14] }}
          transition={{
            duration: compact ? 4.8 : 3.2 + (star.id % 5),
            repeat: Infinity,
            delay: star.delay,
          }}
        />
      ))}
      <div className="absolute left-[-90px] top-[42%] h-80 w-80 rounded-full border border-aureate/10" />
      <div className="absolute left-[-52px] top-[calc(42%+38px)] h-60 w-60 rounded-full border border-aurora/10" />
      <div className="absolute right-[-140px] top-[-110px] h-[390px] w-[390px] rounded-full border border-quantum/10" />
      <div className="absolute right-[-80px] top-[-50px] h-[270px] w-[270px] rounded-full border border-photon/10" />
    </div>
  );
}
