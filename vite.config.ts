import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' })],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
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
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'decky-frontend-lib'],
      output: {
        format: 'es',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
