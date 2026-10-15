import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Inline config stops Vite from picking up a PostCSS setup from a parent folder.
  css: { postcss: {} },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: { dashboard: 'dashboard.html' } },
  },
  test: { globals: true, environment: 'node' },
});
