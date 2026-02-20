"use client";

import type { ReactNode } from "react";
import { SectionLabel } from "./SectionLabel";

interface ModalProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, footer, onClose }: ModalProps) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="bg-white border border-app-border p-8 max-w-md w-full">
          <SectionLabel className="block mb-4">{title}</SectionLabel>
          <div className="text-sm text-app-text">{children}</div>
          {footer && (
            <div className="flex justify-end gap-3 mt-6">{footer}</div>
          )}
        </div>
      </div>
    </>
  );
}
