import { useState } from 'react';
import { Modal } from './Modal';
import { Field, TextInput } from './Field';

/**
 * Typed confirmation. This guards against a misclick, NOT against intent — an allowlisted UID
 * can always delete via the SDK or REST. There is no point-in-time recovery on this plan, so a
 * delete is recoverable only as far back as the last JSON export.
 */
export function DeleteDialog({
  projectName, busy, error, onCancel, onConfirm,
}: {
  projectName: string; busy: boolean; error: string | null;
  onCancel: () => void; onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === projectName.trim() && projectName.trim() !== '';

  return (
    <Modal title="Delete project" onClose={onCancel}>
      <p className="text-sm text-[var(--color-ink)]">
        This permanently deletes <strong>{projectName || '(untitled)'}</strong>.
      </p>
      <p className="mt-2 text-sm text-[var(--color-ink-3)]">
        There is no undo and no point-in-time recovery on this plan. It is recoverable only from a
        JSON export you took earlier.
      </p>

      <div className="mt-4">
        <Field label={`Type the project name to confirm`}>
          {(id) => (
            <TextInput id={id} value={typed} onChange={(e) => setTyped(e.target.value)}
              placeholder={projectName} autoComplete="off" />
          )}
        </Field>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-[var(--color-accent)]">{error}</p>}

      <div className="mt-6 flex gap-3">
        <button
          type="button" disabled={!matches || busy} onClick={onConfirm}
          className="border border-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-accent)] hover:bg-[var(--color-paper-2)] disabled:opacity-40"
        >
          {busy ? 'Deleting…' : 'Delete permanently'}
        </button>
        <button type="button" onClick={onCancel} className="border border-[var(--color-rule-strong)] px-4 py-2 text-sm hover:border-[var(--color-ink)]">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
