#!/usr/bin/env node
/**
 * Post-build Smoke Test for `dist/index.js`.
 * Verifies that the compiled Rollup Decky bundle loads cleanly in a simulated
 * SteamOS / Decky Loader global environment (window.SP_REACT, window.DFL, deckyFrontendLib)
 * and returns a valid plugin definition with name, icon, content, and onDismount.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import React from 'react';

const distPath = path.resolve(process.cwd(), 'dist/index.js');
if (!fs.existsSync(distPath)) {
  console.error(`[Smoke Test] FAIL: ${distPath} does not exist. Run build first.`);
  process.exit(1);
}

const code = fs.readFileSync(distPath, 'utf-8');
if (code.length < 500) {
  console.error(`[Smoke Test] FAIL: ${distPath} is unexpectedly small (${code.length} bytes).`);
  process.exit(1);
}

// Simulate SteamOS CEF + Decky Loader global environment
const addedRoutes = [];
const removedRoutes = [];

const sandboxWindow = {
  SP_REACT: React,
  SP_JSX: {
    jsx: React.createElement,
    jsxs: React.createElement,
    Fragment: React.Fragment,
  },
  DFL: {
    PanelSection: 'div',
    PanelSectionRow: 'div',
    Field: 'div',
    DropdownItem: 'div',
    ProgressBarWithInfo: 'div',
    ButtonItem: 'button',
    SteamSpinner: 'div',
    Focusable: 'div',
    ModalRoot: 'div',
    staticClasses: { Title: 'decky-title' },
    Navigation: {
      Navigate: () => {},
      NavigateBack: () => {},
      CloseSideMenus: () => {},
    },
    routerHook: {
      addRoute: (r) => addedRoutes.push(r),
      removeRoute: (r) => removedRoutes.push(r),
    },
  },
  __DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit: {
    connect: (_ver, _name) => ({
      _version: 2,
      call: async () => [],
      routerHook: {
        addRoute: (r) => addedRoutes.push(r),
        removeRoute: (r) => removedRoutes.push(r),
      },
    }),
  },
  DeckyPluginLoader: {
    callServerMethod: async () => ({ result: [] }),
    routerHook: {
      addRoute: (r) => addedRoutes.push(r),
      removeRoute: (r) => removedRoutes.push(r),
    },
  },
  deckyFrontendLib: {
    definePlugin: (fn) => fn,
    routerHook: {
      addRoute: (r) => addedRoutes.push(r),
      removeRoute: (r) => removedRoutes.push(r),
    },
  },
  document: {
    getElementById: () => null,
    createElement: () => ({ id: '', textContent: '' }),
    head: { appendChild: () => {} },
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    clear: () => {},
  },
  console,
  setTimeout,
  clearTimeout,
};

sandboxWindow.window = sandboxWindow;
sandboxWindow.globalThis = sandboxWindow;

// Transform ESM export default to a global capture if needed
const executableCode = code
  .replace(/export\s+default\s+/, 'globalThis.__DECKY_PLUGIN_EXPORT__ = ')
  .replace(/export\s*\{\s*([a-zA-Z0-9_$]+)\s+as\s+default\s*\}\s*;?/, 'globalThis.__DECKY_PLUGIN_EXPORT__ = $1;');

const context = vm.createContext(sandboxWindow);
vm.runInContext(executableCode, context, { filename: 'dist/index.js' });

const exported = sandboxWindow.__DECKY_PLUGIN_EXPORT__;
if (typeof exported !== 'function') {
  console.error('[Smoke Test] FAIL: dist/index.js default export is not a plugin factory function.');
  process.exit(1);
}

const pluginInstance = exported();
if (!pluginInstance || pluginInstance.name !== 'Next Unlock' || !pluginInstance.content) {
  console.error('[Smoke Test] FAIL: Plugin instance missing expected properties:', pluginInstance);
  process.exit(1);
}

if (typeof pluginInstance.onDismount === 'function') {
  pluginInstance.onDismount();
}

console.log(`[Smoke Test] PASS: dist/index.js (${(code.length / 1024).toFixed(1)} KB) initialized 'Next Unlock' cleanly.`);
