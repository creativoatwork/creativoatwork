export default function Hero() {
  return (
    <section
      id="home"
      /* Header is sticky and therefore in flow, so subtract its exact height to
         make header + hero occupy precisely one viewport.
         Header = logo (h-9 / sm:h-10) + py-4 (32px) + 1px bottom border. */
      className="gutter relative flex min-h-[calc(100svh-69px)] flex-col justify-end pb-8 pt-20 sm:min-h-[calc(100svh-73px)] sm:pb-10 sm:pt-28 [@media(max-height:820px)]:pt-12 [@media(max-height:820px)]:sm:pt-14"
    >
      <div className="reveal reveal-1 flex items-center gap-3 font-mono text-xs text-[var(--color-ink-3)]">
        <span aria-hidden className="h-px w-8 bg-[var(--color-rule-strong)]" />
        <span>A New York Web and Platform Development Studio</span>
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
          Creativo@Work builds custom applications, storefronts, and learning platforms for small to
          mid-sized companies — and modernizes the ones that outgrew their stack. Strategy before
          code, performance measured after, no fluff in between.
        </p>
        <div className="flex items-center gap-3">
          <a
            href="#work"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-ink)] px-5 py-3 text-sm font-medium text-[var(--color-paper)] transition-colors hover:bg-[var(--color-accent)]"
          >
            See the work
            <span aria-hidden>↘</span>
          </a>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-rule-strong)] px-5 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
          >
            Start a conversation
          </a>
        </div>
      </div>

      <div className="reveal reveal-4 mt-12 flex items-end justify-between gap-6 sm:mt-16">
        <dl className="flex flex-wrap gap-x-10 gap-y-3 font-mono text-[11px] text-[var(--color-ink-3)]">
          <div>
            <dt className="sr-only">Stack</dt>
            <dd>TypeScript · React · Headless CMS · WooCommerce</dd>
          </div>
          <div>
            <dt className="sr-only">Practice</dt>
            <dd>Legacy modernization · AI integration · CI/CD</dd>
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
