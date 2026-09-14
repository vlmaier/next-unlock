import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

function deckyTransformPlugin(): Plugin {
  return {
    name: 'decky-transform-plugin',
    renderChunk(code) {
      let newCode = code;
      // Replace bare module imports of react and react-dom with SteamUI window.SP_REMOTES bindings
      newCode = newCode.replace(
        /import\s+([A-Za-z0-9_$]+)\s*,\s*\{([^}]+)\}\s*from\s*['"]react['"];?/g,
        'const $1 = (typeof window !== "undefined" && window.SP_REMOTES?.react) || (typeof globalThis !== "undefined" && globalThis.React) || {}; const {$2} = $1;'
      );
      newCode = newCode.replace(
        /import\s+([A-Za-z0-9_$]+)\s*from\s*['"]react['"];?/g,
        'const $1 = (typeof window !== "undefined" && window.SP_REMOTES?.react) || (typeof globalThis !== "undefined" && globalThis.React) || {};'
      );
      newCode = newCode.replace(
        /import\s+([A-Za-z0-9_$]+)\s*from\s*['"]react-dom['"];?/g,
        'const $1 = (typeof window !== "undefined" && window.SP_REMOTES?.reactDOM) || (typeof globalThis !== "undefined" && globalThis.ReactDOM) || {};'
      );
      return { code: newCode, map: null };
    },
  };
}

export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' }), deckyTransformPlugin()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
    'global': 'window',
  },
  build: {
    outDir: 'dist',
    minify: false,
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
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
