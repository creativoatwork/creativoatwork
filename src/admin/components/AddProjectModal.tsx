import { useState } from 'react';
import { Modal } from './Modal';
import { ProjectForm, useProjectForm } from './ProjectForm';
import { EMPTY_PROJECT, normalize } from '../data/types';
import { createProject } from '../data/projects';

/**
 * Domain first, then everything else by hand.
 *
 * Earlier drafts probed the domain server-side to infer host and stack. That required a
 * URL-fetching endpoint with JWT verification and SSRF guards on the Worker that serves the live
 * contact form — a large, risky surface to save a few seconds of typing. It was cut; see the
 * spec's revision history and backlog.md.
 */
export function AddProjectModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (id: string) => void }) {
  const form = useProjectForm(EMPTY_PROJECT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createProject(normalize(form.value));
      onCreated(id);
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'unknown';
      setError(
        code === 'permission-denied'
          ? 'Firestore refused the write. The rules may not list this UID yet.'
          : `Could not save (${code}).`,
      );
      setBusy(false);
    }
  };

  return (
    <Modal title="Add project" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <ProjectForm value={form.value} onChange={form.setValue} errors={form.errors} />
        {error && <p role="alert" className="mt-4 text-sm text-[var(--color-accent)]">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button type="submit" disabled={busy}
            className="border border-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] disabled:opacity-50">
            {busy ? 'Saving…' : 'Save project'}
          </button>
          <button type="button" onClick={onClose}
            className="border border-[var(--color-rule-strong)] px-4 py-2 text-sm hover:border-[var(--color-ink)]">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
