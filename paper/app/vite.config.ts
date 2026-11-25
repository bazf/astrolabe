import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { offlinePlugin } from '../tools/offline.ts';

// base './' keeps asset paths relative so the build works on any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react(), offlinePlugin()],
  server: { port: 5173, host: true },
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), print: resolve(__dirname, 'print.html') },
    },
  },
});
