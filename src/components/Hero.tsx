export default function Hero() {
  return (
    <section
      id="home"
      className="gutter relative flex min-h-[88svh] flex-col justify-end pb-16 pt-32 sm:pb-24 sm:pt-40"
    >
      <div className="reveal reveal-1 flex items-center gap-3 font-mono text-xs text-[var(--color-ink-3)]">
        <span aria-hidden className="h-px w-8 bg-[var(--color-rule-strong)]" />
        <span>A Brooklyn web development studio</span>
      </div>

      <h1 className="reveal reveal-2 display mt-8 max-w-[18ch]">
        We design,
        <br />
        build, and
        <br />
        <span className="text-[var(--color-accent)]">elevate</span> the web.
      </h1>

      <div className="reveal reveal-3 mt-12 grid items-start gap-x-12 gap-y-6 sm:mt-16 sm:grid-cols-[1fr_auto]">
        <p className="lede">
          Creativo@Work partners with small to mid-sized companies on corporate sites, scalable
          eCommerce, and eLearning platforms. Strategy first, craft throughout, performance
          measured. No fluff. Results that move the business.
        </p>
        <div className="flex items-center gap-3">
          <a
            href="#work"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm font-medium text-[var(--color-paper)] transition-colors hover:bg-[var(--color-accent)]"
          >
            See the work
            <span aria-hidden>↘</span>
          </a>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-rule-strong)] px-5 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
          >
            Start a conversation
          </a>
        </div>
      </div>

      <div className="reveal reveal-4 mt-20 flex items-end justify-between gap-6 border-t border-[var(--color-rule)] pt-6 sm:mt-28">
        <dl className="flex flex-wrap gap-x-10 gap-y-3 font-mono text-[11px] text-[var(--color-ink-3)]">
          <div>
            <dt className="sr-only">Capabilities</dt>
            <dd>WordPress · WooCommerce · LMS · Web apps</dd>
          </div>
          <div>
            <dt className="sr-only">Approach</dt>
            <dd>Goal oriented · Performance focused</dd>
          </div>
        </dl>
        <a
          href="#services"
          aria-label="Scroll to services"
          className="font-mono text-[11px] text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
        >
          ↓ scroll
        </a>
      </div>
    </section>
  );
}
