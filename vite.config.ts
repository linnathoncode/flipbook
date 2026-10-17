import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const BACKGROUND_ENTRY = 'background';

// package.json holds the one version number; the manifest and the dashboard both read it from there.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

// Chrome only takes one to four dot-separated numbers, so "1.0.0-beta" would be refused by the store.
const CHROME_VERSION = /^\d+(\.\d+){0,3}$/;

function manifest(): Plugin {
  return {
    name: 'flipbook-manifest',
    buildStart() {
      this.addWatchFile('manifest.json');
      if (!CHROME_VERSION.test(version)) this.error(`Chrome can't use version "${version}". Use numbers only, like 1.2.0.`);
    },
    generateBundle() {
      const source = JSON.parse(readFileSync('manifest.json', 'utf8'));
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: `${JSON.stringify({ ...source, version }, null, 2)}\n` });
    },
  };
}

export default defineConfig({
  plugins: [react(), manifest()],
  define: { __APP_VERSION__: JSON.stringify(version) },
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
