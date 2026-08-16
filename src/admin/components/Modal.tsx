import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Focus is trapped while open, Esc closes, and focus returns to whatever opened it.
 * Keyboard reachability is part of the accessibility floor, private tool or not.
 */
export function Modal({
  title, onClose, children,
}: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (f.length === 0) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      restoreTo.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[color-mix(in_oklch,var(--color-night)_55%,transparent)] p-4 sm:p-8">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-2xl border border-[var(--color-rule-strong)] bg-[var(--color-paper)] p-6"
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-3)]">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-[var(--color-ink-3)] hover:text-[var(--color-ink)]">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
