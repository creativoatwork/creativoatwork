import { useState } from 'react';
import {
  HOSTS, FRONTENDS, DATABASES, STATUSES, LABELS, LIMITS,
  validate, type ProjectFields,
} from '../data/types';
import { Field, TextInput, TextArea, Select } from './Field';

/** Shared by the Add modal and the detail view, so both enforce identical rules. */
export function ProjectForm({
  value, onChange, errors,
}: {
  value: ProjectFields;
  onChange: (v: ProjectFields) => void;
  errors: Partial<Record<keyof ProjectFields, string>>;
}) {
  const set = <K extends keyof ProjectFields>(k: K, v: ProjectFields[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Domain" error={errors.domain} hint="Hostname only — goodai.news, not https://goodai.news">
          {(id) => (
            <TextInput
              id={id} value={value.domain} invalid={!!errors.domain}
              onChange={(e) => set('domain', e.target.value)}
              placeholder="goodai.news" autoCapitalize="none" spellCheck={false}
            />
          )}
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label="Project name" error={errors.name}>
          {(id) => (
            <TextInput
              id={id} value={value.name} invalid={!!errors.name}
              onChange={(e) => set('name', e.target.value)} maxLength={LIMITS.name}
            />
          )}
        </Field>
      </div>

      <Field label="Host">{(id) => (
        <Select id={id} value={value.host} options={HOSTS} labels={LABELS.host} onChange={(v) => set('host', v)} />
      )}</Field>

      <Field label="Status">{(id) => (
        <Select id={id} value={value.status} options={STATUSES} labels={LABELS.status} onChange={(v) => set('status', v)} />
      )}</Field>

      <Field label="Frontend">{(id) => (
        <Select id={id} value={value.frontend} options={FRONTENDS} labels={LABELS.frontend} onChange={(v) => set('frontend', v)} />
      )}</Field>

      <Field label="Database">{(id) => (
        <Select id={id} value={value.database} options={DATABASES} labels={LABELS.database} onChange={(v) => set('database', v)} />
      )}</Field>

      <div className="sm:col-span-2">
        <Field label="GitHub repo" error={errors.repoUrl} hint="Optional. https://github.com/owner/repo">
          {(id) => (
            <TextInput
              id={id} value={value.repoUrl} invalid={!!errors.repoUrl}
              onChange={(e) => set('repoUrl', e.target.value)}
              placeholder="https://github.com/owner/repo" spellCheck={false}
            />
          )}
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label="Description" error={errors.description}>
          {(id) => (
            <TextArea id={id} rows={2} value={value.description} invalid={!!errors.description}
              onChange={(e) => set('description', e.target.value)} maxLength={LIMITS.description} />
          )}
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label="Notes" error={errors.notes}>
          {(id) => (
            <TextArea id={id} rows={6} value={value.notes} invalid={!!errors.notes}
              onChange={(e) => set('notes', e.target.value)} maxLength={LIMITS.notes} />
          )}
        </Field>
      </div>
    </div>
  );
}

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
