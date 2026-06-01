"use client";

import { motion } from "framer-motion";

const stars = Array.from({ length: 52 }, (_, index) => ({
  id: index,
  left: `${(index * 37 + 11) % 100}%`,
  top: `${(index * 61 + 7) % 100}%`,
  delay: (index % 8) * 0.42,
  size: index % 9 === 0 ? 2 : 1,
}));

export function AmbientBackground({ compact = false }: { compact?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-space">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(0,212,255,0.13),transparent_22%),radial-gradient(circle_at_82%_6%,rgba(124,58,237,0.16),transparent_25%),radial-gradient(circle_at_58%_92%,rgba(2,132,199,0.08),transparent_30%)]" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(56,189,248,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.14)_1px,transparent_1px)] [background-size:46px_46px]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(124,58,237,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(124,58,237,0.2)_1px,transparent_1px)] [background-size:230px_230px]" />
      {stars.map((star) => (
        <motion.span
          key={star.id}
          className="absolute rounded-full bg-cyan-100 shadow-[0_0_8px_rgba(103,232,249,0.9)]"
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
      <div className="absolute left-[-90px] top-[42%] h-80 w-80 rounded-full border border-cyan-400/10" />
      <div className="absolute left-[-52px] top-[calc(42%+38px)] h-60 w-60 rounded-full border border-violet-400/10" />
      <div className="absolute right-[-140px] top-[-110px] h-[390px] w-[390px] rounded-full border border-violet-400/10" />
      <div className="absolute right-[-80px] top-[-50px] h-[270px] w-[270px] rounded-full border border-cyan-400/10" />
    </div>
  );
}
