import { useState, type FormEvent } from 'react';

type Status = 'idle' | 'sending' | 'ok' | 'error';

const ERROR_COPY: Record<string, string> = {
  invalid_input: 'Please fill in your name, email, and a short message.',
  invalid_email: 'That email address looks off — mind double-checking?',
  rate_limited: 'That’s a few messages in quick succession — give it a minute, then try again.',
  send_failed: 'Our mailer hiccuped. Try again in a moment, or write us directly.',
  internal_error: 'Something broke on our end. Try again, or write us directly.',
  network: 'Network problem — check your connection and try again.',
};

export default function Contact() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending') return;

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      message: String(fd.get('message') ?? ''),
      company: String(fd.get('company') ?? ''),
    };

    setStatus('sending');
    setErrorKey(null);

    const endpoint = import.meta.env.VITE_CONTACT_URL;
    if (!endpoint) {
      setStatus('error');
      setErrorKey('internal_error');
      console.error('VITE_CONTACT_URL is not set. Configure .env.production before building.');
      return;
    }

    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (r.ok && data.ok) {
        setStatus('ok');
      } else {
        setStatus('error');
        setErrorKey(data.error ?? 'internal_error');
      }
    } catch {
      setStatus('error');
      setErrorKey('network');
    }
  };

  return (
    <section
      id="contact"
      className="gutter relative bg-[var(--color-night)] py-24 text-[var(--color-paper)] sm:py-32"
    >
      <header className="grid gap-12 sm:grid-cols-[auto_1fr] sm:gap-x-16">
        <div className="font-mono text-xs text-[oklch(0.86_0.02_85/0.65)]">04 / Contact</div>
        <div>
          <h2 className="display-md max-w-[16ch] text-[var(--color-paper)]">
            Let’s talk about your next project.
          </h2>
          <p className="lede mt-6 text-[oklch(0.92_0.012_85/0.85)]">
            Book a call, ask a question, send a brief. We typically reply within one business day.
          </p>
        </div>
      </header>

      <div className="mt-16 grid gap-16 sm:mt-20 sm:grid-cols-[1.2fr_1fr] sm:gap-x-20">
        <div>
          {status === 'ok' ? (
            <div className="rounded-2xl border border-[var(--color-night-rule)] bg-[var(--color-night-2)] p-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-[oklch(0.86_0.02_85/0.7)]">
                Received
              </p>
              <p className="display-md mt-2 text-[var(--color-paper)]">Thanks — we’ll be in touch.</p>
              <p className="mt-3 text-[oklch(0.92_0.012_85/0.8)]">
                A short note is on its way. If you don’t see a reply within a business day, write us
                at{' '}
                <a
                  href="mailto:hello@creativoatwork.com"
                  className="font-mono underline-offset-4 hover:underline"
                >
                  hello@creativoatwork.com
                </a>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-7" aria-busy={status === 'sending'}>
              <Field
                id="name"
                label="Your name"
                type="text"
                placeholder="Jane Doe"
                autoComplete="name"
                required
                disabled={status === 'sending'}
              />
              <Field
                id="email"
                label="Your email"
                type="email"
                placeholder="jane@company.com"
                autoComplete="email"
                required
                disabled={status === 'sending'}
              />
              <Field
                id="message"
                label="What are you working on?"
                placeholder="A few sentences is plenty."
                rows={5}
                required
                disabled={status === 'sending'}
              />

              {/* Honeypot: hidden from humans, visible to bots */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}>
                <label htmlFor="company">Company (leave blank)</label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="group inline-flex items-center gap-3 rounded-lg bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-[var(--color-night)] transition-colors hover:bg-[var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === 'sending' ? 'Sending…' : 'Send the brief'}
                  <span
                    aria-hidden
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </button>

                {status === 'error' && errorKey && (
                  <p
                    role="alert"
                    className="text-sm text-[oklch(0.82_0.13_30)]"
                  >
                    {ERROR_COPY[errorKey] ?? ERROR_COPY.internal_error}
                  </p>
                )}
              </div>
            </form>
          )}
        </div>

        <aside className="space-y-8 self-start text-sm leading-relaxed text-[oklch(0.92_0.012_85/0.85)] sm:pt-2">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-[oklch(0.86_0.02_85/0.6)]">
              Studio
            </div>
            <p className="mt-2">
              Creativo@Work LLC<br />
              195 Plymouth Street, Suite 5/5<br />
              Brooklyn, NY 11201
            </p>
          </div>

          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-[oklch(0.86_0.02_85/0.6)]">
              Write us
            </div>
            <p className="mt-2">
              <a
                href="mailto:hello@creativoatwork.com"
                className="font-mono text-[var(--color-paper)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
              >
                hello@creativoatwork.com
              </a>
            </p>
          </div>

          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-[oklch(0.86_0.02_85/0.6)]">
              Hours
            </div>
            <p className="mt-2">
              Mon — Fri, 09:00 to 18:00 ET<br />
              Async-friendly across timezones
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

type FieldProps = {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
};

function Field({
  id,
  label,
  type = 'text',
  placeholder,
  autoComplete,
  rows,
  required,
  disabled,
}: FieldProps) {
  const isTextarea = typeof rows === 'number';
  const common =
    'block w-full bg-transparent text-[var(--color-paper)] placeholder:text-[oklch(0.92_0.012_85/0.4)] focus:outline-none border-0 border-b border-[var(--color-night-rule)] focus:border-[var(--color-accent)] py-3 text-[15px] transition-colors disabled:opacity-60';
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[11px] uppercase tracking-[0.04em] text-[oklch(0.86_0.02_85/0.65)]"
      >
        {label}
      </label>
      {isTextarea ? (
        <textarea
          id={id}
          name={id}
          rows={rows}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className={`${common} resize-y`}
        />
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={common}
        />
      )}
    </div>
  );
}
