"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "sm" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  arrow?: boolean;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-app-text bg-app-text text-white px-5 py-2.5 hover:bg-app-accent-hover",
  secondary:
    "border border-app-border bg-transparent text-app-text px-5 py-2.5 hover:bg-app-bg-subtle",
  danger:
    "border border-app-danger bg-transparent text-app-danger px-5 py-2.5 hover:bg-red-50",
  sm: "border border-app-border bg-transparent text-app-text px-3 py-1.5 text-[0.65rem] hover:bg-app-bg-subtle",
  ghost:
    "border border-transparent bg-transparent text-app-muted px-3 py-1.5 hover:text-app-text",
};

export function Button({
  variant = "primary",
  arrow = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center gap-2 font-mono uppercase tracking-button font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
  const sizeClass = variant === "sm" || variant === "ghost" ? "text-[0.65rem]" : "text-xs";

  return (
    <button
      className={`${base} ${sizeClass} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
      {arrow && <span aria-hidden="true">&rarr;</span>}
    </button>
  );
}
