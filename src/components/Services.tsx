const SERVICES = [
  {
    title: 'Custom application engineering',
    blurb: 'Auth, dashboards, APIs, and data models. Software with a real architecture, not a CMS bent into the shape of one.',
  },
  {
    title: 'Legacy platform modernization',
    blurb: 'Aging codebases moved onto current stacks incrementally, with the business still running while it happens.',
  },
  {
    title: 'Headless & composable front-ends',
    blurb: 'React and TypeScript against a decoupled CMS, so the editing experience and the front end stop constraining each other.',
  },
  {
    title: 'eCommerce engineering',
    blurb: 'Storefronts that load fast, convert well, and scale with the catalog instead of fighting it.',
  },
  {
    title: 'Learning platforms',
    blurb: 'LMS platforms with the cohort, certification, and reporting features your operation actually uses.',
  },
  {
    title: 'AI feature integration',
    blurb: 'Retrieval over your own content, assisted workflows, and the evaluation work that tells you whether it’s actually helping.',
  },
  {
    title: 'Cloud infrastructure & delivery',
    blurb: 'Pipelines, environments, monitoring, and the unglamorous operational work that keeps everything quiet.',
  },
  {
    title: 'Product & interface design',
    blurb: 'Interface design grounded in your audience and your goals, not in last quarter’s component library trends.',
  },
  {
    title: 'Performance, SEO & analytics',
    blurb: 'Core Web Vitals, technical SEO, and instrumentation that reads what changed and why.',
  },
];

export default function Services() {
  return (
    <section
      id="services"
      className="gutter relative border-t border-[var(--color-rule)] py-24 sm:py-32"
    >
      <header className="grid gap-12 sm:grid-cols-[auto_1fr] sm:gap-x-16">
        <div className="font-mono text-xs text-[var(--color-ink-3)]">
          01 / Services
        </div>
        <div>
          <h2 className="display-md max-w-[18ch]">
            One studio. <span className="text-[var(--color-ink-3)]">Every layer of the stack.</span>
          </h2>
          <p className="lede mt-6">
            We take on the work most studios hand off — modernizing what exists, building what
            doesn’t, and running it after launch.
          </p>
        </div>
      </header>

      <ol className="mt-16 sm:mt-20">
        {SERVICES.map((s, i) => (
          <li
            key={s.title}
            className="group grid items-baseline gap-x-12 gap-y-2 border-t border-[var(--color-rule)] py-7 transition-colors sm:grid-cols-[auto_1fr_minmax(0,40ch)] sm:py-8 hover:border-[var(--color-ink)]"
          >
            <span className="font-mono text-xs text-[var(--color-ink-3)]">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="font-sans text-xl font-medium tracking-tight text-[var(--color-ink)] sm:text-2xl">
              {s.title}
            </h3>
            <p className="text-sm text-[var(--color-ink-2)] sm:text-[15px]">{s.blurb}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
