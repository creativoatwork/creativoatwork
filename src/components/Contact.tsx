import { useState, type FormEvent } from 'react';

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
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
          {submitted ? (
            <div className="rounded-2xl border border-[var(--color-night-rule)] bg-[var(--color-night-2)] p-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-[oklch(0.86_0.02_85/0.7)]">
                Received
              </p>
              <p className="display-md mt-2 text-[var(--color-paper)]">Thanks — we’ll be in touch.</p>
              <p className="mt-3 text-[oklch(0.92_0.012_85/0.8)]">
                A short note is on its way. If you don’t see it within a business day, write us at
                hello@creativoatwork.com.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-7">
              <Field
                id="name"
                label="Your name"
                type="text"
                placeholder="Jane Doe"
                autoComplete="name"
                required
              />
              <Field
                id="email"
                label="Your email"
                type="email"
                placeholder="jane@company.com"
                autoComplete="email"
                required
              />
              <Field
                id="message"
                label="What are you working on?"
                placeholder="A few sentences is plenty."
                rows={5}
                required
              />
              <button
                type="submit"
                className="group inline-flex items-center gap-3 rounded-full bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-[var(--color-night)] transition-colors hover:bg-[var(--color-paper)]"
              >
                Send the brief
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </button>
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
};

function Field({ id, label, type = 'text', placeholder, autoComplete, rows, required }: FieldProps) {
  const isTextarea = typeof rows === 'number';
  const common =
    'block w-full bg-transparent text-[var(--color-paper)] placeholder:text-[oklch(0.92_0.012_85/0.4)] focus:outline-none border-0 border-b border-[var(--color-night-rule)] focus:border-[var(--color-accent)] py-3 text-[15px] transition-colors';
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
          placeholder={placeholder}
          className={`${common} resize-y`}
        />
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={common}
        />
      )}
    </div>
  );
}
