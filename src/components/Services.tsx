const SERVICES = [
  {
    title: 'WordPress design & development',
    blurb: 'Custom themes and blocks built for editorial control, not for a page builder to drag around.',
  },
  {
    title: 'eCommerce on WooCommerce',
    blurb: 'Storefronts that load fast, convert well, and scale with the catalog instead of fighting it.',
  },
  {
    title: 'Learning management systems',
    blurb: 'LMS platforms with the cohort, certification, and reporting features your operation actually uses.',
  },
  {
    title: 'Web application development',
    blurb: 'Custom dashboards and internal tools, full stack, with the kind of UX a team will keep using.',
  },
  {
    title: 'UI/UX design',
    blurb: 'Interface design grounded in your audience and your goals, not in last quarter’s component library trends.',
  },
  {
    title: 'Performance & analytics',
    blurb: 'Core Web Vitals optimization, instrumentation, and the reporting layer to read what changed and why.',
  },
  {
    title: 'SEO & content strategy',
    blurb: 'Technical SEO, IA, and content systems that compound over the lifetime of the site.',
  },
  {
    title: 'Server & infrastructure',
    blurb: 'Hosting, deployments, backups, and the unglamorous server work that keeps everything quiet.',
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
            Whether you’re launching, rebranding, or scaling, we’re the partner across strategy,
            design, build, and the long tail of optimization that follows.
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
