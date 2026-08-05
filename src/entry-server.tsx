import { renderToString } from 'react-dom/server';
import App from './App';

/**
 * Build-time entry point. Rendered once by scripts/prerender.mjs and injected
 * into dist/index.html so crawlers that do not execute JavaScript — which is
 * most AI crawlers — see the real content instead of an empty root div.
 */
export function render(): string {
  return renderToString(<App />);
}
