import { useEffect, useState } from 'react';

type Project = {
  src: string;
  client: string;
  sector: string;
  scope: string;
  /**
   * Eligible for the double-width slot. Only art wide enough to survive being
   * stretched across two columns qualifies — roughly 1000px or more. Low
   * resolution sources look visibly soft there.
   */
  wideOk?: boolean;
};

/**
 * The pool. Eight of these are shown per visit, chosen at random after the page
 * loads, so repeat visitors see a different cut of the work.
 *
 * To add a project: drop the image in public/img/img_cw/ and add an entry here.
 * The image alone is not enough — each card needs a client, sector, and scope,
 * and none of that can be inferred from a filename.
 *
 * Keep `scope` under about 23 characters. Longer strings wrap and collide with
 * the client name on narrow cards.
 *
 * The first eight entries are what crawlers and no-JavaScript visitors see,
 * since the build prerenders this component before any shuffling happens.
 * Keep the strongest work at the top.
 */
const PROJECTS: Project[] = [
  {
    src: '/img/img_cw/myonlinecopyright.webp',
    client: 'MyOnlineCopyright',
    sector: 'LegalTech · IP',
    scope: 'Sealing & verification',
    wideOk: true,
  },
  {
    src: '/img/img_cw/clima.webp',
    client: 'CLIMA Foundation',
    sector: 'Climate research · Global',
    scope: 'Tiered data access',
    wideOk: true,
  },
  {
    src: '/img/img_cw/landusup.webp',
    client: 'LandUsUp',
    sector: 'Incorporation · Remote',
    scope: 'Incorporation flow',
    wideOk: true,
  },
  {
    src: '/img/img_cw/edge.webp',
    client: 'EDGE Market Insights',
    sector: 'Market intelligence · SaaS',
    scope: 'Subscription platform',
    wideOk: true,
  },
  {
    src: '/img/img_cw/fellow-alumni-network.webp',
    client: 'Fellow Alumni Network',
    sector: 'Nonprofit · Americas',
    scope: 'Directory & matching',
    wideOk: true,
  },
  {
    src: '/img/img_cw/newyork-partners.webp',
    client: 'New York & Partners',
    sector: 'Advisory · NY',
    scope: 'Advisory & intake',
    wideOk: true,
  },
  {
    src: '/img/img_cw/transatlanticinnovationhub.webp',
    client: 'Transatlantic Innovation Hub',
    sector: 'Innovation hub · NYC',
    scope: 'Membership & intake',
    wideOk: true,
  },
  {
    src: '/img/img_cw/h-ventures.webp',
    client: 'H-Ventures US',
    sector: 'Open innovation · NYC',
    scope: 'Innovation lab site',
    wideOk: true,
  },
  {
    src: '/img/img_cw/startupaccountant.webp',
    client: 'Startup Accountant',
    sector: 'Accounting · Remote',
    scope: 'Formation & compliance',
    wideOk: true,
  },
  {
    src: '/img/img_cw/elninosabe.webp',
    client: 'El Niño Sabe',
    sector: 'Streetwear · Drop',
    scope: 'Launch site & waitlist',
    wideOk: true,
  },
  {
    src: '/img/img_cw/siscc.webp',
    client: 'SISCC Academy',
    sector: 'Education · LMS',
    scope: 'Course platform',
  },
  {
    src: '/img/img_cw/cyrus-preview.webp',
    client: 'Cyrus Company',
    sector: 'Furniture · Italy',
    scope: 'Brand site & catalog',
  },
  {
    src: '/img/img_cw/gallery-preview.png',
    client: 'Gallery Records',
    sector: 'Music · Label',
    scope: 'Catalog & releases',
  },
  {
    src: '/img/img_cw/podcastfarm.jpg',
    client: 'Podcast Farm',
    sector: 'Media · Production',
    scope: 'Editorial & shows',
  },
  {
    src: '/img/img_cw/mariottistudio.jpg',
    client: 'Mariotti Studio',
    sector: 'Architecture · Studio',
    scope: 'Portfolio & journal',
  },
  {
    src: '/img/img_cw/donnsterling-preview.png',
    client: 'Donn Sterling',
    sector: 'Consultancy · NY',
    scope: 'Portfolio site',
  },
];

/** One wide card plus seven standard tiles to exactly three rows at desktop. */
const VISIBLE = 8;

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Picks the visit's line-up. The first slot is double width, so it is filled
 * from the high-resolution entries; everything else is drawn at random.
 */
function pickLineup(pool: Project[]): Project[] {
  const rest = shuffled(pool);
  const heroIndex = rest.findIndex((p) => p.wideOk);
  const [hero] = rest.splice(heroIndex === -1 ? 0 : heroIndex, 1);
  return [hero, ...rest].slice(0, VISIBLE);
}

export default function Work() {
  // The server render and the first client render must match exactly or
  // hydration breaks, so both start from a fixed slice. The shuffle happens
  // once, after mount. This section sits below the fold, so the swap lands
  // long before it is scrolled into view.
  const [lineup, setLineup] = useState<Project[]>(() => PROJECTS.slice(0, VISIBLE));

  useEffect(() => {
    setLineup(pickLineup(PROJECTS));
  }, []);

  return (
    <section
      id="work"
      className="gutter relative border-t border-[var(--color-rule)] py-24 sm:py-32"
    >
      <header className="grid gap-12 sm:grid-cols-[auto_1fr] sm:gap-x-16">
        <div className="font-mono text-xs text-[var(--color-ink-3)]">02 / Selected work</div>
        <div>
          <h2 className="display-md max-w-[16ch]">
            Platforms we designed, built, and still run.
          </h2>
          <p className="lede mt-6">
            Platforms, storefronts, and internal tools across a dozen sectors. Each one shipped,
            measured, and still running.
          </p>
        </div>
      </header>

      <div className="mt-16 grid auto-rows-[minmax(260px,1fr)] grid-cols-1 gap-5 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
        {lineup.map((p, i) => (
          <a
            key={p.src}
            href="#contact"
            className={`group relative overflow-hidden rounded-lg bg-[var(--color-paper-2)] ${
              i === 0 ? 'sm:col-span-2' : ''
            }`}
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
          {String(VISIBLE).padStart(2, '0')} of {PROJECTS.length}
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
