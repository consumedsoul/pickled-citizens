'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

type GuestModalProps = {
  firstName: string;
  lastName: string;
  dupr: string;
  error: string | null;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onDuprChange: (value: string) => void;
  onCancel: () => void;
  onAdd: () => void;
};

export function GuestModal({
  firstName,
  lastName,
  dupr,
  error,
  onFirstNameChange,
  onLastNameChange,
  onDuprChange,
  onCancel,
  onAdd,
}: GuestModalProps) {
  return (
    <Modal
      title="Add guest player"
      onClose={onCancel}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={onAdd}>
            Add guest
          </Button>
        </>
      }
    >
      <p className="text-app-muted mb-4">
        Guests join this session only. They are not added to the league and do not appear in
        lifetime stats.
      </p>
      <div className="grid gap-4">
        <Input
          label="First name"
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          autoFocus
        />
        <Input
          label="Last name (optional)"
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
        />
        <Input
          label="DUPR (1.0–8.5)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="1.0"
          max="8.5"
          value={dupr}
          onChange={(e) => onDuprChange(e.target.value)}
        />
        {error && <p className="text-app-danger text-sm">{error}</p>}
      </div>
    </Modal>
  );
}
