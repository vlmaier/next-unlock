import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';

function inlineGeneratedCssPlugin() {
  const virtualId = '\0virtual:generated-css.js';
  return {
    name: 'inline-generated-css',
    enforce: 'pre' as const,
    resolveId(source: string) {
      if (source.endsWith('generated.css')) {
        return virtualId;
      }
      return null;
    },
    load(id: string) {
      if (id === virtualId) {
        const cssPath = path.resolve(__dirname, 'src/generated.css');
        const code = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8') : '';
        return `
if (typeof document !== 'undefined') {
  let style = document.getElementById('next-unlock-styles');
  if (!style) {
    style = document.createElement('style');
    style.id = 'next-unlock-styles';
    document.head.appendChild(style);
  }
  style.textContent = ${JSON.stringify(code)};
}
export default ${JSON.stringify(code)};
`;
      }
      return null;
    },
  };
}

function deckyPythonBridgePlugin() {
  return {
    name: 'decky-python-rpc-bridge',
    configureServer(server: any) {
      server.middlewares.use('/__decky_rpc__', (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          execFile(
            'python3',
            [path.resolve(__dirname, 'scripts/rpc_cli.py'), body],
            { cwd: __dirname, timeout: 5000 },
            (err, stdout) => {
              res.setHeader('Content-Type', 'application/json');
              if (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(err) }));
                return;
              }
              res.statusCode = 200;
              res.end(stdout);
            }
          );
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [inlineGeneratedCssPlugin(), react(), deckyPythonBridgePlugin()],
  resolve: {
    alias: {
      '@decky/manifest': path.resolve(__dirname, 'plugin.json'),
      '@decky/ui': path.resolve(__dirname, 'src/components/deckyUi.tsx'),
      '@decky/api': path.resolve(__dirname, 'src/__mocks__/decky-api.ts'),
    },
  },
});
