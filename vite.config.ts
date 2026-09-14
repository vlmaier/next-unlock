import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
    'global': 'window',
  },
  build: {
    outDir: 'dist',
    minify: true,
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'NextUnlock',
      fileName: () => 'index.js',
      formats: ['es'],
    },
    // Bundle React & Lucide inline so Chrome/Decky Loader requires zero external importmaps
    rollupOptions: {
      output: {
        format: 'es',
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
