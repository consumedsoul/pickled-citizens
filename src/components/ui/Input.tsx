"use client";

import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: React.ReactNode;
}

const inputClasses =
  "w-full px-3 py-2.5 border border-app-border bg-transparent text-app-text text-sm font-sans placeholder:text-app-light-gray focus:outline-none focus:border-app-text transition-colors";

export function Input({ label, className = "", id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <input id={inputId} className={`${inputClasses} ${className}`} {...props} />
    </div>
  );
}

export function Select({ label, className = "", id, children, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
        </label>
      )}
      <select id={selectId} className={`${inputClasses} ${className}`} {...props}>
        {children}
      </select>
    </div>
  );
}
