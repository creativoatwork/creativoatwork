export function ErrorBanner({
  code, message, onRetry,
}: { code?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="border border-[var(--color-accent)] bg-[var(--color-paper-2)] px-4 py-3 text-sm">
      <p className="text-[var(--color-ink)]">{message}</p>
      {code && <p className="mt-1 font-mono text-xs text-[var(--color-ink-3)]">{code}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 border border-[var(--color-rule-strong)] px-3 py-1 text-xs hover:border-[var(--color-ink)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/** Skeleton rows rather than a spinner — the shape of what is coming is more informative. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading projects" className="divide-y divide-[var(--color-rule)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-3 py-3">
          <div className="h-4 w-1/4 bg-[var(--color-paper-2)]" />
          <div className="h-4 w-1/6 bg-[var(--color-paper-2)]" />
          <div className="h-4 w-1/6 bg-[var(--color-paper-2)]" />
          <div className="h-4 w-1/12 bg-[var(--color-paper-2)]" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-[var(--color-rule-strong)] px-6 py-12 text-center">
      <p className="text-[var(--color-ink)]">{title}</p>
      {hint && <p className="mt-1 text-sm text-[var(--color-ink-3)]">{hint}</p>}
    </div>
  );
}
