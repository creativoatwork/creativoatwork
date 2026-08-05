// Injects a statically rendered copy of the app into dist/index.html.
//
// Vite ships an empty <div id="root"></div>, which means any crawler that does
// not run JavaScript sees a blank page. Google usually renders JS; the AI
// crawlers largely do not. This step closes that gap at build time.
//
// Fails loudly rather than silently shipping an empty page.

import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const htmlPath = resolve(root, 'dist/index.html');
const ssrEntry = resolve(root, 'dist-ssr/entry-server.js');
const EMPTY_ROOT = '<div id="root"></div>';

if (!existsSync(htmlPath)) {
  throw new Error(`prerender: ${htmlPath} not found — run the client build first.`);
}
if (!existsSync(ssrEntry)) {
  throw new Error(`prerender: ${ssrEntry} not found — run the SSR build first.`);
}

const template = readFileSync(htmlPath, 'utf8');
if (!template.includes(EMPTY_ROOT)) {
  throw new Error(
    'prerender: could not find an empty root div in dist/index.html. ' +
      'The markup changed, or the file was already prerendered.',
  );
}

const { render } = await import(pathToFileURL(ssrEntry).href);
const appHtml = render();

if (!appHtml || appHtml.length < 1000) {
  throw new Error(
    `prerender: rendered output was only ${appHtml?.length ?? 0} bytes, which suggests the ` +
      'render failed. Refusing to ship a near-empty page.',
  );
}

writeFileSync(htmlPath, template.replace(EMPTY_ROOT, `<div id="root">${appHtml}</div>`));
rmSync(resolve(root, 'dist-ssr'), { recursive: true, force: true });

console.log(`prerender: injected ${appHtml.length.toLocaleString()} bytes of static HTML`);
