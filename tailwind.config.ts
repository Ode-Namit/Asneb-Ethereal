import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        space: "#070712",
        midnight: "#10131F",
        quantum: "#B99CFF",
        photon: "#8BE9FF",
        starlight: "#F5F0E8",
        pearl: "#FFFAF0",
        moon: "#DFE7F3",
        aureate: "#F6D78A",
        aurora: "#F8B8D9",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        neon: "0 0 32px rgba(139, 233, 255, 0.18)",
        violet: "0 0 34px rgba(185, 156, 255, 0.2)",
        halo: "0 20px 70px rgba(246, 215, 138, 0.12)",
      },
      animation: {
        "spin-slow": "spin 18s linear infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "scan-line": "scan-line 6s linear infinite",
        float: "float 8s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
          "50%": { opacity: "0.9", transform: "scale(1.06)" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
