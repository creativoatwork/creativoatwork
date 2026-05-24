import { useEffect, useState } from 'react';

const LINKS = [
  { href: '#services', label: 'Services', index: '01' },
  { href: '#work', label: 'Work', index: '02' },
  { href: '#about', label: 'About', index: '03' },
  { href: '#contact', label: 'Contact', index: '04' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header
        className={`gutter sticky top-0 z-[1000] flex items-center justify-between py-4 transition-[background-color,backdrop-filter,border-color] duration-300 ${
          scrolled
            ? 'border-b border-[var(--color-rule)] bg-[color-mix(in_oklch,var(--color-paper)_82%,transparent)] backdrop-blur-md'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <a
          href="#home"
          className="inline-flex items-center"
          aria-label="Creativo@Work home"
        >
          <img
            src="/img/logo.png"
            alt="Creativo@Work"
            className="block h-9 w-auto sm:h-10"
          />
        </a>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-[12px] uppercase tracking-[0.06em] text-[var(--color-ink)] inline-flex items-center gap-2"
        >
          <span aria-hidden className="relative inline-block h-2.5 w-4">
            <span
              className={`absolute left-0 right-0 h-px bg-current transition-transform duration-300 ${
                open ? 'top-1 rotate-45 translate-y-px' : 'top-0'
              }`}
            />
            <span
              className={`absolute left-0 right-0 h-px bg-current transition-transform duration-300 ${
                open ? 'top-1 -rotate-45 translate-y-px' : 'bottom-0'
              }`}
            />
          </span>
          {open ? 'Close' : 'Menu'}
        </button>
      </header>

      <nav
        id="primary-menu"
        aria-label="Primary"
        aria-hidden={!open}
        className={`fixed inset-0 z-[999] flex flex-col bg-[var(--color-paper)] transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-2'
        }`}
      >
        <div className="gutter flex flex-1 flex-col justify-center">
          <ol className="flex flex-col">
            {LINKS.map((l, i) => (
              <li
                key={l.href}
                className={`border-t border-[var(--color-rule)] ${
                  i === LINKS.length - 1 ? 'border-b' : ''
                }`}
              >
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="group flex items-baseline justify-between gap-6 py-6 text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)] sm:py-8"
                >
                  <span className="display-md">{l.label}</span>
                  <span className="font-mono text-xs tracking-tight text-[var(--color-ink-3)] transition-colors group-hover:text-[var(--color-accent)]">
                    {l.index}
                  </span>
                </a>
              </li>
            ))}
          </ol>
          <p className="lede mt-12 font-mono text-xs text-[var(--color-ink-3)]">
            <a href="mailto:hello@creativoatwork.com" className="hover:text-[var(--color-accent)]">
              hello@creativoatwork.com
            </a>
            <span aria-hidden> &nbsp;/&nbsp; </span>
            <span>195 Plymouth St · Brooklyn, NY</span>
          </p>
        </div>
      </nav>
    </>
  );
}
