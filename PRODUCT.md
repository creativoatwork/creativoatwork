# Product

## Register

brand

## Users

Founders, marketing leads, and creative directors at small-to-midsize companies evaluating a web partner — increasingly with a technical evaluator in the buying group: a CTO, lead engineer, or technical co-founder asked to answer "can they actually build this?"

They arrive from a referral, a Dribbble/LinkedIn click, a direct search after meeting the founder, or — since the site became crawlable — a search engine or AI assistant answering a question about this kind of work. Context: scanning on a laptop between meetings, or on mobile after-hours.

The two readers filter differently, and the site has to satisfy both. The non-technical reader is looking for craft and seriousness in 5–10 seconds before deciding whether to scroll. The technical reader is looking for specifics — a named stack, real architecture, evidence of systems that shipped and stayed up — and discounts anything that reads as marketing. The job: confirm "these people can ship, and the work won't embarrass me."

## Product Purpose

Creativo@Work is a New York web and platform development studio. We build custom applications, headless commerce, and learning platforms for small to mid-sized companies, and modernize the systems that outgrew their stack. The studio is based in Brooklyn; the positioning is New York, because the work and the clients are not neighborhood-scale.

The site exists to convert a warm visitor into a contact conversation. Success looks like: a qualified prospect who books a call or writes hello@ after a single visit, having understood scope, capability, and aesthetic without reading a "Services" sub-page.

A second purpose was added on 2026-08-05: the site should be **findable** by people searching for this work, through search engines and AI assistants alike. This is why the site is prerendered rather than client-rendered. An empty root div is invisible to any crawler that does not execute JavaScript, which is most of the AI ones — and a studio that cannot be found by the tools its clients use is making an argument against itself.

## Capabilities

What the studio can truthfully claim, confirmed by the founder on 2026-08-05. **Nothing may be added to this list on the site without checking first.** An unbacked capability claim is worse than an omission: it survives exactly until the first technical call.

- Headless and modern JavaScript front-ends — React, TypeScript, decoupled CMS
- Custom application engineering — auth, dashboards, APIs, integrations, data modeling
- Legacy application transformation
- Cloud infrastructure, CI/CD, observability
- AI and LLM feature work

The earlier revenue lines — WordPress, WooCommerce commerce, LMS builds — remain current and are still delivered. They are **demoted in the hierarchy, not dropped**: leading with CMS product names prices the studio as an implementation shop, which is the specific problem the 2026-08-05 repositioning set out to fix.

## Brand Personality

Confident, considered, calm. The voice is low-volume but specific. Not loud, not corporate, not "fun-agency." Closer to a senior designer talking through work in their studio than a sales deck. Three words: composed, deliberate, current.

## Anti-references

- Generic WordPress agency template: pastel band sections, identical card grids, hero stat tiles, "trusted by" logo marquees, stock-photo-with-white-overlay heroes.
- Loud / maximalist: gradient text, multi-color hero compositions, decorative SVG blobs, scroll-driven 3D, heavy animation.
- Corporate consulting beige: navy-and-gold palettes, conservative stock photography, McKinsey-shaped seriousness.
- Generic SaaS marketing: feature-icon grids, big-number metric heroes, lavender gradients, identical three-column "Why us" sections.

## Design Principles

1. **Show, don't claim.** Work block carries the weight; copy is a frame, not a sales pitch. If a sentence could appear on any agency site, cut or rewrite it. Concretely: a capability named in Services needs a matching project in Selected work. Claiming AI or modernization work above a grid of brochure sites is worse than claiming neither.
2. **Quiet confidence over volume.** One accent color, restrained motion, generous space. The visitor should feel the craft before they notice the design.
3. **Editorial rhythm, not slide deck.** Sections vary in density, scale, and entry. No uniform "band of pastel + headline + paragraph" repetition.
4. **Typography is the visual system.** A two-family stack does most of the design work. Color is restrained on purpose so type can lead.
5. **Every detail intentional.** Focus rings, hover transitions, link affordances, form micro-states. A studio site that has rough edges is self-disqualifying.

## Accessibility & Inclusion

WCAG 2.2 AA floor. Body contrast ≥4.5:1, large text ≥3:1, interactive controls with visible focus rings (≥3:1 against background). Full keyboard navigation including the mobile menu. Respect `prefers-reduced-motion` for all transitions and any scroll-linked effects. All imagery has meaningful alt text or `alt=""` when decorative. Form fields have associated labels (not just placeholders) and inline error messaging.
