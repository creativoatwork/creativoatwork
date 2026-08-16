import { useId, type ReactNode } from 'react';

const base =
  'w-full border border-[var(--color-rule-strong)] bg-[var(--color-paper)] px-3 py-2 text-sm ' +
  'text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-ink)]';

/** Every control gets a real <label>, per the accessibility floor in PRODUCT.md. */
export function Field({
  label, error, hint, children,
}: { label: string; error?: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-mono text-xs uppercase tracking-wide text-[var(--color-ink-3)]">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-xs text-[var(--color-ink-3)]">{hint}</p>}
      {error && (
        <p id={errId} role="alert" className="text-xs text-[var(--color-accent)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean },
) {
  const { invalid, className, ...rest } = props;
  return <input {...rest} aria-invalid={invalid || undefined} className={`${base} ${className ?? ''}`} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean },
) {
  const { invalid, className, ...rest } = props;
  return <textarea {...rest} aria-invalid={invalid || undefined} className={`${base} ${className ?? ''}`} />;
}

export function Select<T extends string>({
  id, value, options, labels, onChange,
}: {
  id?: string; value: T; options: readonly T[];
  labels: Record<T, string>; onChange: (v: T) => void;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={base}>
      {options.map((o) => (
        <option key={o} value={o}>{labels[o]}</option>
      ))}
    </select>
  );
}
