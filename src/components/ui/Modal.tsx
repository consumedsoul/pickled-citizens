"use client";

import { type ReactNode, useId } from "react";
import { SectionLabel } from "./SectionLabel";
import { useDialogBehavior } from "./useDialogBehavior";

interface ModalProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, footer, onClose }: ModalProps) {
  const dialogRef = useDialogBehavior<HTMLDivElement>(onClose);
  const titleId = useId();

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="bg-white border border-app-border p-8 max-w-md w-full focus:outline-none"
        >
          <SectionLabel id={titleId} className="block mb-4">{title}</SectionLabel>
          <div className="text-sm text-app-text">{children}</div>
          {footer && (
            <div className="flex justify-end gap-3 mt-6">{footer}</div>
          )}
        </div>
      </div>
    </>
  );
}
