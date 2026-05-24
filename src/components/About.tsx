const FACTS = [
  { k: 'Studio', v: 'Brooklyn, NY' },
  { k: 'Founded', v: '2020' },
  { k: 'Team', v: 'Small by design' },
  { k: 'Stack', v: 'WordPress · Woo · Custom' },
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
            We don’t take on projects. We take on missions. Strategic thinking, precise execution,
            and a deep respect for your time and your goals.
          </p>
          <p className="body">
            Our work is clean, modern, and crafted to move the needle. Whether you’re launching a
            digital product, reimagining your online presence, or building the tools your team
            actually needs, we stay lean so we stay close to the work, the client, and the result.
          </p>
          <p className="body">
            When you work with us, you don’t get a service provider. You get a partner who builds
            with intention and delivers with impact.
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
