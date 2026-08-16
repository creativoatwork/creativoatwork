import { useState } from 'react';
import {
  HOSTS, FRONTENDS, DATABASES, STATUSES, LABELS, LIMITS,
  validate, type ProjectFields,
} from '../data/types';
import { Field, TextInput, TextArea, Select } from './Field';

/**
 * Form state plus validation, shared by the Add modal and the detail page.
 *
 * The two surfaces deliberately do NOT share a layout: adding a project asks for the two things
 * you actually know at that moment, while the detail page is the full record. A single
 * component trying to be both was worse than two explicit ones.
 */
export function useProjectForm(initial: ProjectFields) {
  const [value, setValue] = useState<ProjectFields>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFields, string>>>({});
  const check = () => {
    const e = validate(value);
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  return { value, setValue, errors, setErrors, check };
}

type Setter = (v: ProjectFields) => void;
const set = <K extends keyof ProjectFields>(
  value: ProjectFields, onChange: Setter, k: K, v: ProjectFields[K],
) => onChange({ ...value, [k]: v });

interface Part {
  value: ProjectFields;
  onChange: Setter;
  errors: Partial<Record<keyof ProjectFields, string>>;
}

/** Domain and name — the only two fields asked for when a project is created. */
export function IdentityFields({ value, onChange, errors, withStatus }: Part & { withStatus?: boolean }) {
  return (
    <div className={`grid gap-4 ${withStatus ? 'sm:grid-cols-[2fr_2fr_1fr]' : 'sm:grid-cols-2'}`}>
      <Field label="Domain" error={errors.domain} hint="Hostname only — goodai.news">
        {(id) => (
          <TextInput
            id={id} value={value.domain} invalid={!!errors.domain}
            onChange={(e) => set(value, onChange, 'domain', e.target.value)}
            placeholder="goodai.news" autoCapitalize="none" spellCheck={false}
          />
        )}
      </Field>

      <Field label="Project name" error={errors.name}>
        {(id) => (
          <TextInput
            id={id} value={value.name} invalid={!!errors.name}
            onChange={(e) => set(value, onChange, 'name', e.target.value)}
            maxLength={LIMITS.name}
          />
        )}
      </Field>

      {withStatus && (
        <Field label="Status">
          {(id) => (
            <Select
              id={id} value={value.status} options={STATUSES} labels={LABELS.status}
              onChange={(v) => set(value, onChange, 'status', v)}
            />
          )}
        </Field>
      )}
    </div>
  );
}

export function RepoField({ value, onChange, errors }: Part) {
  return (
    <Field label="GitHub repo" error={errors.repoUrl} hint="Optional. https://github.com/owner/repo">
      {(id) => (
        <TextInput
          id={id} value={value.repoUrl} invalid={!!errors.repoUrl}
          onChange={(e) => set(value, onChange, 'repoUrl', e.target.value)}
          placeholder="https://github.com/owner/repo" spellCheck={false}
        />
      )}
    </Field>
  );
}

export function DescriptionField({ value, onChange, errors }: Part) {
  return (
    <Field label="Description" error={errors.description}>
      {(id) => (
        <TextArea
          id={id} rows={2} value={value.description} invalid={!!errors.description}
          onChange={(e) => set(value, onChange, 'description', e.target.value)}
          maxLength={LIMITS.description}
        />
      )}
    </Field>
  );
}

/**
 * Host, frontend and database. These drive the table's filters, so they stay manual even though
 * the gatherer often reveals the same facts — a filter that only works on gathered projects
 * would be worse than one that is sometimes 'unknown'.
 */
export function ClassificationFields({ value, onChange }: Part) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Host">
        {(id) => (
          <Select id={id} value={value.host} options={HOSTS} labels={LABELS.host}
            onChange={(v) => set(value, onChange, 'host', v)} />
        )}
      </Field>
      <Field label="Frontend">
        {(id) => (
          <Select id={id} value={value.frontend} options={FRONTENDS} labels={LABELS.frontend}
            onChange={(v) => set(value, onChange, 'frontend', v)} />
        )}
      </Field>
      <Field label="Database">
        {(id) => (
          <Select id={id} value={value.database} options={DATABASES} labels={LABELS.database}
            onChange={(v) => set(value, onChange, 'database', v)} />
        )}
      </Field>
    </div>
  );
}

export function NotesField({ value, onChange, errors }: Part) {
  return (
    <Field label="Notes" error={errors.notes}>
      {(id) => (
        <TextArea
          id={id} rows={8} value={value.notes} invalid={!!errors.notes}
          onChange={(e) => set(value, onChange, 'notes', e.target.value)}
          maxLength={LIMITS.notes}
        />
      )}
    </Field>
  );
}
