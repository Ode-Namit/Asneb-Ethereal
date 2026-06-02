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
      "border-aureate/40 bg-aureate/[0.12] text-pearl hover:border-aureate/75 hover:bg-aureate/[0.18] hover:shadow-halo",
    ghost:
      "border-pearl/15 bg-pearl/[0.06] text-moon hover:border-photon/35 hover:bg-photon/[0.08] hover:text-white",
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
