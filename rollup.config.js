import { defineConfig } from 'rollup';
import deckyPlugin from '@decky/rollup';
import css from 'rollup-plugin-import-css';

export default defineConfig(
  deckyPlugin({
    plugins: [css({ output: 'style.css' })],
  })
);
