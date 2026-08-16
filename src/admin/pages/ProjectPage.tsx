import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { subscribeProjects, updateProject, deleteProject } from '../data/projects';
import type { Project, ProjectFields } from '../data/types';
import { normalize } from '../data/types';
import {
  IdentityFields, RepoField, DescriptionField, ClassificationFields, NotesField, useProjectForm,
} from '../components/ProjectForm';
import { DeleteDialog } from '../components/DeleteDialog';
import { ErrorBanner } from '../components/States';
import { EnrichmentPanel } from '../components/EnrichmentPanel';

const toFields = (p: Project): ProjectFields => ({
  name: p.name, description: p.description, repoUrl: p.repoUrl, domain: p.domain,
  host: p.host, frontend: p.frontend, database: p.database, status: p.status, notes: p.notes,
});

export function ProjectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<{ code: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const form = useProjectForm({
    name: '', description: '', repoUrl: '', domain: '',
    host: 'unknown', frontend: 'unknown', database: 'unknown', status: 'active', notes: '',
  });
  const { setValue } = form;

  useEffect(() => {
    return subscribeProjects(
      (all) => {
        const found = all.find((p) => p.id === id) ?? null;
        setProject(found);
        // Only seed the form from the server on first load; later snapshots must not clobber
        // edits in progress.
        setValue((prev) =>
          prev.name === '' && prev.domain === '' && found ? toFields(found) : prev,
        );
      },
      (e) => setLoadError(e),
    );
  }, [id, setValue]);

  const original = useMemo(() => (project ? toFields(project) : null), [project]);
  const dirty = !!original && JSON.stringify(normalize(form.value)) !== JSON.stringify(normalize(original));

  // A dirty form must not be lost to a stray reload or back-navigation.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !form.check()) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await updateProject(
        project.id,
        normalize(form.value),
        project.createdAt,
        // From the live document, not from form state: a Save must never undo a Gather.
        project.enrichment,
        project.enrichedAt,
      );
      setSaved(true);
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'unknown';
      setSaveError(
        code === 'permission-denied'
          ? 'Firestore refused the write. Check the rules allowlist and the field constraints.'
          : `Could not save (${code}).`,
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!project) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProject(project.id);
      navigate('/');
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'unknown';
      setDeleteError(`Could not delete (${code}).`);
      setDeleting(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrorBanner code={loadError.code} message={loadError.message} />
      </div>
    );
  }
  if (project === undefined) {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-[var(--color-ink-3)]">Loading…</div>;
  }
  if (project === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-[var(--color-ink)]">That project does not exist.</p>
        <Link to="/" className="mt-3 inline-block text-sm underline underline-offset-4">Back to all projects</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <nav className="mb-6">
        <Link
          to="/"
          onClick={(e) => {
            if (dirty && !window.confirm('Discard unsaved changes?')) e.preventDefault();
          }}
          className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
        >
          ← all projects
        </Link>
      </nav>

      <form onSubmit={save} noValidate>
        {/* Order is deliberate: identity, where it lives, what it is, what was gathered about
            it, then free-text notes, then immutable metadata. */}
        <div className="space-y-5">
          <IdentityFields value={form.value} onChange={form.setValue} errors={form.errors} withStatus />
          <RepoField value={form.value} onChange={form.setValue} errors={form.errors} />
          <DescriptionField value={form.value} onChange={form.setValue} errors={form.errors} />
        </div>

        <EnrichmentPanel
          repoUrl={form.value.repoUrl}
          domain={form.value.domain}
          enrichment={project.enrichment}
          enrichedAt={project.enrichedAt}
          current={{ host: form.value.host, frontend: form.value.frontend, database: form.value.database, status: form.value.status }}
          onApply={(patch) => form.setValue({ ...form.value, ...patch })}
          onSave={async (enrichment, at) => {
            // Written straight through rather than staged in the form: gathered fact, not an
            // edit in progress, and it must survive navigating away without a Save.
            await updateProject(project.id, normalize(form.value), project.createdAt, enrichment, at);
          }}
        />

        <div className="mt-6 space-y-5">
          <ClassificationFields value={form.value} onChange={form.setValue} errors={form.errors} />
          <NotesField value={form.value} onChange={form.setValue} errors={form.errors} />
        </div>

        {saveError && <div className="mt-4"><ErrorBanner message={saveError} /></div>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit" disabled={saving || !dirty}
            className="border border-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] disabled:opacity-40"
          >
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
          {saved && !dirty && (
            <span role="status" className="text-xs text-[var(--color-ink-3)]">Saved.</span>
          )}
          <button
            type="button" onClick={() => setConfirming(true)}
            className="ml-auto border border-[var(--color-rule-strong)] px-4 py-2 text-sm text-[var(--color-accent)] hover:border-[var(--color-accent)]"
          >
            Delete
          </button>
        </div>
      </form>

      <dl className="mt-8 grid grid-cols-2 gap-2 border-t border-[var(--color-rule)] pt-4 font-mono text-xs text-[var(--color-ink-3)]">
        <dt>Created</dt>
        <dd className="tabular-nums">{project.createdAt?.toISOString().slice(0, 10) ?? '—'}</dd>
        <dt>Updated</dt>
        <dd className="tabular-nums">{project.updatedAt?.toISOString().slice(0, 10) ?? '—'}</dd>
        <dt>Document ID</dt>
        <dd className="break-all">{project.id}</dd>
      </dl>

      {confirming && (
        <DeleteDialog
          projectName={project.name}
          busy={deleting}
          error={deleteError}
          onCancel={() => { setConfirming(false); setDeleteError(null); }}
          onConfirm={() => void remove()}
        />
      )}
    </div>
  );
}
