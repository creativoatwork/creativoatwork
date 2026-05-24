export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[var(--color-night)] text-[oklch(0.92_0.012_85/0.85)]">
      <div className="gutter border-t border-[var(--color-night-rule)] py-12">
        <div className="grid gap-12 sm:grid-cols-[1.4fr_1fr_1fr] sm:gap-x-12">
          <div>
            <a
              href="#home"
              className="inline-flex items-center"
              aria-label="Creativo@Work home"
            >
              <img
                src="/img/creativologow.png"
                alt="Creativo@Work"
                className="block h-12 w-auto sm:h-14"
              />
            </a>
            <p className="mt-5 max-w-[40ch] text-sm leading-relaxed">
              A small studio building considered websites and platforms for small to mid-sized
              companies. From idea to launch, and well past it.
            </p>
          </div>

          <nav aria-label="Footer" className="text-sm">
            <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-[oklch(0.86_0.02_85/0.55)]">
              Navigate
            </div>
            <ul className="mt-3 space-y-2">
              {[
                ['Services', '#services'],
                ['Work', '#work'],
                ['About', '#about'],
                ['Contact', '#contact'],
              ].map(([label, href]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="text-[var(--color-paper)] hover:text-[var(--color-accent)]"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <address className="text-sm not-italic leading-relaxed">
            <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-[oklch(0.86_0.02_85/0.55)]">
              Studio
            </div>
            <p className="mt-3 text-[var(--color-paper)]">Creativo@Work LLC</p>
            <p>195 Plymouth Street, Suite 5/5</p>
            <p>Brooklyn, NY 11201 · USA</p>
            <p className="mt-3">
              <a
                href="mailto:hello@creativoatwork.com"
                className="font-mono text-[var(--color-paper)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
              >
                hello@creativoatwork.com
              </a>
            </p>
          </address>
        </div>

        <div className="mt-12 flex flex-wrap items-baseline justify-between gap-y-3 border-t border-[var(--color-night-rule)] pt-6 font-mono text-[11px] text-[oklch(0.86_0.02_85/0.55)]">
          <span>© {year} Creativo@Work LLC. All rights reserved.</span>
          <a
            href="/terms.html"
            className="text-[var(--color-paper)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}
