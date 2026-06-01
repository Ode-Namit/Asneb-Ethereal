import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "border-cyan-300/35 bg-cyan-400/[0.11] text-cyan-50 hover:border-cyan-300/75 hover:bg-cyan-300/[0.17] hover:shadow-neon",
    ghost:
      "border-slate-500/20 bg-slate-900/35 text-slate-300 hover:border-cyan-300/35 hover:bg-cyan-400/[0.07] hover:text-white",
    danger:
      "border-rose-400/20 bg-rose-400/[0.06] text-rose-200 hover:border-rose-300/45 hover:bg-rose-400/[0.12]",
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold tracking-wide transition duration-300 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
