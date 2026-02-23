import type { ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function SectionLabel({ children, className = "", id }: SectionLabelProps) {
  return (
    <span id={id} className={`section-label ${className}`}>
      {children}
    </span>
  );
}
