// Окрема конфігурація для паперової партії (40 хв): не чіпає збірку застосунку (vite.config.ts).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  root: __dirname,
  plugins: [react()],
  server: { port: 4318, strictPort: true },
});
