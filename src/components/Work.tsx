type Project = {
  src: string;
  client: string;
  sector: string;
  scope: string;
  span: 'wide' | 'tall' | 'std';
};

const PROJECTS: Project[] = [
  {
    src: '/img/img_cw/cyrus-preview.png',
    client: 'Cyrus Company',
    sector: 'Furniture · Italy',
    scope: 'Brand site & catalog',
    span: 'wide',
  },
  {
    src: '/img/img_cw/donnsterling-preview.png',
    client: 'Donn Sterling',
    sector: 'Consultancy · NY',
    scope: 'Portfolio site',
    span: 'std',
  },
  {
    src: '/img/img_cw/gallery-preview.png',
    client: 'Gallery Records',
    sector: 'Music · Label',
    scope: 'Catalog & releases',
    span: 'tall',
  },
  {
    src: '/img/img_cw/podcastfarm.jpg',
    client: 'Podcast Farm',
    sector: 'Media · Production',
    scope: 'Editorial & shows',
    span: 'std',
  },
  {
    src: '/img/img_cw/mariottistudio.jpg',
    client: 'Mariotti Studio',
    sector: 'Architecture · Studio',
    scope: 'Portfolio & journal',
    span: 'std',
  },
  {
    src: '/img/img_cw/siscc.png',
    client: 'SISCC Academy',
    sector: 'Education · LMS',
    scope: 'Course platform',
    span: 'wide',
  },
];

const spanClass: Record<Project['span'], string> = {
  wide: 'sm:col-span-2',
  tall: 'sm:row-span-2',
  std: '',
};

export default function Work() {
  return (
    <section
      id="work"
      className="gutter relative border-t border-[var(--color-rule)] py-24 sm:py-32"
    >
      <header className="grid gap-12 sm:grid-cols-[auto_1fr] sm:gap-x-16">
        <div className="font-mono text-xs text-[var(--color-ink-3)]">02 / Selected work</div>
        <div>
          <h2 className="display-md max-w-[16ch]">
            Built for businesses that needed to grow up, online.
          </h2>
          <p className="lede mt-6">
            A short list across sectors. Each project shipped with goals defined first, performance
            measured after, and the kind of finish that doesn’t need a redesign at twelve months.
          </p>
        </div>
      </header>

      <div className="mt-16 grid auto-rows-[minmax(260px,1fr)] grid-cols-1 gap-5 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
        {PROJECTS.map((p, i) => (
          <a
            key={p.src}
            href="#contact"
            className={`group relative overflow-hidden rounded-lg bg-[var(--color-paper-2)] ${spanClass[p.span]}`}
            aria-label={`${p.client} — case study (request)`}
          >
            <img
              src={p.src}
              alt={`${p.client} — ${p.scope}`}
              loading={i < 2 ? 'eager' : 'lazy'}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[oklch(0.22_0.04_263/0.85)] via-[oklch(0.22_0.04_263/0.25)] to-transparent p-5">
              <div className="flex items-baseline justify-between gap-4 text-[var(--color-paper)]">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.04em] text-[oklch(0.92_0.02_85/0.85)]">
                    {p.sector}
                  </div>
                  <div className="mt-1 text-base font-medium tracking-tight">{p.client}</div>
                </div>
                <div className="font-mono text-[10px] tracking-[0.04em] text-[oklch(0.92_0.02_85/0.85)]">
                  {p.scope}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-[var(--color-rule)] pt-6 text-sm">
        <span className="font-mono text-xs text-[var(--color-ink-3)]">
          {PROJECTS.length.toString().padStart(2, '0')} of many
        </span>
        <a
          href="#contact"
          className="inline-flex items-center gap-2 text-[var(--color-ink)] hover:text-[var(--color-accent)]"
        >
          Request a deeper look <span aria-hidden>→</span>
        </a>
      </div>
    </section>
  );
}
