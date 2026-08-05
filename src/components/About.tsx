const FACTS = [
  { k: 'Studio', v: 'Brooklyn, NY' },
  { k: 'Founded', v: '2020' },
  { k: 'Team', v: 'Small by design' },
  { k: 'Stack', v: 'TypeScript · React · Headless' },
];

export default function About() {
  return (
    <section
      id="about"
      className="gutter relative border-t border-[var(--color-rule)] py-24 sm:py-32"
    >
      <header className="grid gap-12 sm:grid-cols-[auto_1fr] sm:gap-x-16">
        <div className="font-mono text-xs text-[var(--color-ink-3)]">03 / About</div>
        <div>
          <h2 className="display-md max-w-[18ch]">
            Designed to be different. Built to deliver.
          </h2>
        </div>
      </header>

      <div className="mt-16 grid gap-12 sm:mt-20 sm:grid-cols-[1fr_auto] sm:gap-x-20">
        <div className="space-y-6">
          <p className="lede text-[clamp(1.15rem,1.6vw,1.45rem)]">
            We stay small so the people who scope your project are the people who build it. No
            account layer, no handoff between the brief and the code.
          </p>
          <p className="body">
            Most of our work starts with something that already exists — a platform that outgrew its
            stack, a site nobody can edit without a developer, an internal tool held together by
            spreadsheets. We modernize incrementally, in production, instead of proposing the
            year-long rewrite that never ships.
          </p>
          <p className="body">
            Fewer projects at once, direct access to the people building, and a bias toward decisions
            you can still reverse in eighteen months.
          </p>
        </div>

        <dl className="grid w-full grid-cols-2 gap-x-8 gap-y-6 self-start border-l border-[var(--color-rule)] pl-8 sm:w-[20rem] sm:grid-cols-1">
          {FACTS.map((f) => (
            <div key={f.k}>
              <dt className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--color-ink-3)]">
                {f.k}
              </dt>
              <dd className="mt-1 text-sm font-medium text-[var(--color-ink)] sm:text-base">
                {f.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
