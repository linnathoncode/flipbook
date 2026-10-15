import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKGROUND_ENTRY = 'background';

export default defineConfig({
  plugins: [react()],
  // Inline config stops Vite from picking up a PostCSS setup from a parent folder.
  css: { postcss: {} },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { dashboard: 'dashboard.html', [BACKGROUND_ENTRY]: 'src/background/index.ts' },
      output: {
        // The manifest points at a fixed service worker path.
        entryFileNames: (chunk) => (chunk.name === BACKGROUND_ENTRY ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  test: { globals: true, environment: 'node' },
});
