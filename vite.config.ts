import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Two independent entry points.
//
//   index.html      -> src/main.tsx        marketing, prerendered, must contain no Firebase
//   admindash.html  -> src/admin/main.tsx  private dashboard, never prerendered
//
// They share nothing but design tokens (src/theme.css). Keeping them separate is what stops
// the ~200KB Firebase SDK from landing in the bundle every marketing visitor downloads, and
// what stops /admindash from hydrating into prerendered marketing markup.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admindash: resolve(__dirname, 'admindash.html'),
      },
    },
  },
});
