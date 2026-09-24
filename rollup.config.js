import { defineConfig } from 'rollup';
import deckyPlugin from '@decky/rollup';
import path from 'path';
import fs from 'fs';

function inlineCssPlugin() {
  return {
    name: 'inline-css',
    resolveId(source, importer) {
      if (source.endsWith('.css') && importer) {
        return path.resolve(path.dirname(importer), source);
      }
      return null;
    },
    load(id) {
      if (id.endsWith('.css')) {
        const code = fs.readFileSync(id, 'utf-8');
        try {
          fs.mkdirSync('dist', { recursive: true });
          fs.writeFileSync('dist/style.css', code);
        } catch {}
        return `
if (typeof document !== 'undefined') {
  try {
    let style = document.getElementById('next-unlock-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'next-unlock-styles';
      document.head.appendChild(style);
    }
    style.textContent = ${JSON.stringify(code)};
  } catch (err) {
    console.error('[Next Unlock] Style injection error:', err);
  }
}
export default ${JSON.stringify(code)};
`;
      }
      return null;
    }
  };
}

export default defineConfig(
  deckyPlugin({
    plugins: [inlineCssPlugin()],
  })
);
