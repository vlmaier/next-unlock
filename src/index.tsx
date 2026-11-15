import React from 'react';
import { FaTrophy } from 'react-icons/fa';
import { DeckyContent, FullDashboardPage, ErrorBoundary } from './components/PluginRoot';
import { staticClasses } from './components/deckyUi';
import { definePlugin, routerHook } from '@decky/api';
import cssText from './generated.css';

if (typeof document !== 'undefined') {
  try {
    let style = document.getElementById('next-unlock-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'next-unlock-styles';
      document.head.appendChild(style);
    }
    style.textContent = typeof cssText === 'string' ? cssText : '';
  } catch (err) {
    console.error('[Next Unlock] Style injection error:', err);
  }
}

// Ensure Decky Loader SP_JSX fallback compatibility
if (typeof window !== 'undefined') {
  const w = window as any;
  if (!w.SP_JSX) {
    const reactObj = w.SP_REACT || w.SP_REMOTES?.react || React;
    w.SP_JSX = {
      jsx: reactObj?.createElement || React.createElement,
      jsxs: reactObj?.createElement || React.createElement,
      Fragment: reactObj?.Fragment || 'div',
    };
  }
}

export default definePlugin(() => {
  try {
    routerHook?.addRoute?.('/next-unlock', FullDashboardPage, { exact: true });
  } catch (e) {
    console.warn('[Next Unlock] routerHook addRoute error:', e);
  }

  return {
    name: 'Next Unlock',
    title: <div className={staticClasses?.Title || 'font-bold text-sm'}>Next Unlock</div>,
    titleView: <div className={staticClasses?.Title || 'font-bold text-sm'}>Next Unlock</div>,
    content: (
      <ErrorBoundary>
        <DeckyContent />
      </ErrorBoundary>
    ),
    icon: <FaTrophy />,
    onDismount() {
      try {
        routerHook?.removeRoute?.('/next-unlock');
      } catch {}
    },
  };
});
