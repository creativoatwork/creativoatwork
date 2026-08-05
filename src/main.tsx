import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const container = document.getElementById('root')!;
const tree = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Production builds are prerendered (see scripts/prerender.mjs), so hydrate the
// existing markup. `vite dev` serves an empty root, so fall back to a fresh render.
if (container.firstElementChild) {
  hydrateRoot(container, tree);
} else {
  createRoot(container).render(tree);
}
