import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { DeckyContent, FullDashboardPage } from './components/PluginRoot';
import { __setCallFn, clearApiCache } from './services/steamApi';
import { MockSteamClientService } from './services/mockSteamClient';
import { Monitor, Smartphone, Gamepad2, RotateCcw, Radio } from 'lucide-react';
import './index.css';

if (typeof window !== 'undefined') {
  (window as any).__NEXT_UNLOCK_TEST_HARNESS__ = true;
}

type SimRunningApp = 'none' | 1245620 | 1091500 | 1145350 | 367520 | 2062430 | 2186680 | 999999;

function configureSimulatedSteamOS(runningApp: SimRunningApp) {
  if (typeof window === 'undefined') return;
  const w = window as any;

  const appNames: Record<number, string> = {
    1245620: 'Elden Ring',
    1091500: 'Cyberpunk 2077',
    1145350: 'Hades II',
    367520: 'Hollow Knight',
    2062430: 'BALL x PIT',
    2186680: 'Warhammer 40,000: Rogue Trader — Void Shadows Deluxe Edition',
    999999: 'Untracked Indie Prototype (0 Achievements)',
  };

  w.Router = {
    MainRunningApp:
      runningApp === 'none'
        ? undefined
        : {
            appid: runningApp,
            display_name: appNames[runningApp] || `App ${runningApp}`,
          },
  };

  // Wire rpc call Fn: tries live Python backend at /__decky_rpc__ first, else MockSteamClientService
  __setCallFn(async (method: string, ...args: any[]) => {
    try {
      const resp = await fetch('/__decky_rpc__', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, args }),
      });
      if (resp.ok) {
        const json = await resp.json();
        return json.result;
      }
    } catch {}

    // Local in-browser RPC simulation matching main.py contract
    if (method === 'get_active_app') {
      if (runningApp === 'none') return null;
      return { appid: runningApp, name: appNames[runningApp] };
    }
    if (method === 'get_games') {
      const games = await MockSteamClientService.getGames();
      // Include a 0-achievement game to test switching to games without achievements
      const withZeroAch = [
        ...games,
        {
          appid: 999999,
          name: 'Untracked Indie Prototype',
          header_image: '',
          total_achievements: 0,
          unlocked_count: 0,
          completion_percentage: 0,
          achievements: [],
        },
      ];
      return withZeroAch;
    }
    if (method === 'get_game_details') {
      const appid = Number(args[0]);
      if (appid === 999999) {
        return {
          game: {
            appid: 999999,
            name: 'Untracked Indie Prototype',
            header_image: '',
            total_achievements: 0,
            unlocked_count: 0,
            completion_percentage: 0,
            achievements: [],
          },
          ranked: {
            pinned: [],
            up_next: [],
            almost_there: [],
            easy_grabs: [],
            missable: [],
            locked: [],
            unlocked: [],
          },
        };
      }
      return MockSteamClientService.getGameDetails(appid);
    }
    if (method === 'toggle_pin') {
      return MockSteamClientService.togglePin(String(args[0]));
    }
    if (method === 'get_pinned') {
      return MockSteamClientService.getPinned();
    }
    if (method === 'sync_unlocked_achievements') {
      return { appid: Number(args[0]), synced_count: (args[1] || []).length };
    }
    return null;
  });
}

configureSimulatedSteamOS('none');

const HarnessApp: React.FC = () => {
  const [viewMode, setViewMode] = useState<'qam' | 'dashboard'>('qam');
  const [runningApp, setRunningApp] = useState<SimRunningApp>('none');
  const [mountKey, setMountKey] = useState<number>(1);

  useEffect(() => {
    const onNavigate = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.path === '/next-unlock') {
        setViewMode('dashboard');
      }
    };
    const onNavigateBack = () => {
      setViewMode('qam');
    };
    window.addEventListener('next-unlock:navigate', onNavigate);
    window.addEventListener('next-unlock:navigate-back', onNavigateBack);
    return () => {
      window.removeEventListener('next-unlock:navigate', onNavigate);
      window.removeEventListener('next-unlock:navigate-back', onNavigateBack);
    };
  }, []);

  const handleRunningAppChange = (nextApp: SimRunningApp) => {
    setRunningApp(nextApp);
    clearApiCache();
    configureSimulatedSteamOS(nextApp);
    setMountKey((k) => k + 1);
  };

  const handleResetCache = () => {
    clearApiCache();
    configureSimulatedSteamOS(runningApp);
    setMountKey((k) => k + 1);
  };

  return (
    <div
      data-theme="steam_slate"
      className="min-h-screen bg-[#0e141b] text-slate-100 font-sans flex flex-col"
    >
      {/* Top SteamOS / Decky Hardware Emulator Bar */}
      <header className="bg-[#161f2c] border-b border-[#2e3d52] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-slate-100">
          <Gamepad2 className="w-4 h-4 text-[#389fff]" />
          <span>Decky Loader SteamOS Emulator</span>
          <span className="bg-[#0e141b] text-[#389fff] px-2 py-0.5 rounded text-[10px] font-semibold border border-[#2e3d52]">
            Production Entrypoint (src/index.tsx)
          </span>
        </div>

        {/* Simulated Active Steam Game Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#0e141b] px-2.5 py-1 rounded-lg border border-[#2e3d52]">
            <Radio className={`w-3.5 h-3.5 ${runningApp === 'none' ? 'text-slate-500' : 'text-emerald-400 animate-pulse'}`} />
            <span className="text-[11px] text-slate-400 font-semibold">SteamOS Active Game:</span>
            <select
              value={String(runningApp)}
              onChange={(e) => {
                const v = e.target.value;
                handleRunningAppChange(v === 'none' ? 'none' : (Number(v) as SimRunningApp));
              }}
              className="bg-transparent text-slate-100 font-bold text-xs focus:outline-none cursor-pointer"
            >
              <option value="none" className="bg-[#161f2c]">None (No Active Game / Library Mode)</option>
              <option value="1245620" className="bg-[#161f2c]">Running: Elden Ring (1245620)</option>
              <option value="1091500" className="bg-[#161f2c]">Running: Cyberpunk 2077 (1091500)</option>
              <option value="1145350" className="bg-[#161f2c]">Running: Hades II (1145350)</option>
              <option value="367520" className="bg-[#161f2c]">Running: Hollow Knight (367520)</option>
              <option value="2062430" className="bg-[#161f2c]">Running: BALL x PIT (2062430)</option>
              <option value="2186680" className="bg-[#161f2c]">Running: Rogue Trader Long Title (2186680)</option>
              <option value="999999" className="bg-[#161f2c]">Running: 0-Achievement Game (999999)</option>
            </select>
          </div>

          {/* Surface Switcher */}
          <button
            type="button"
            onClick={() => setViewMode('qam')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors border ${
              viewMode === 'qam'
                ? 'bg-[#389fff] text-white border-[#389fff] font-bold'
                : 'bg-[#1e293b] text-slate-300 border-[#2e3d52] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> QAM Drawer (320px)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('dashboard')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors border ${
              viewMode === 'dashboard'
                ? 'bg-[#389fff] text-white border-[#389fff] font-bold'
                : 'bg-[#1e293b] text-slate-300 border-[#2e3d52] hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> Full Dashboard Route
          </button>

          <button
            type="button"
            onClick={handleResetCache}
            title="Clear memory & localStorage caches"
            className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-[#1e293b] border border-[#2e3d52] rounded-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Cache</span>
          </button>
        </div>
      </header>

      {/* Main Emulated Steam Deck 1280x800 Viewport */}
      <main key={mountKey} className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <div
          data-testid="steam-deck-screen"
          className="w-[1280px] h-[800px] max-w-full bg-[#0e141b] border border-[#2e3d52] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
        >
          {/* SteamOS Floating Top Status Overlay (40px, exact Deck Gaming Mode position) */}
          <div
            data-testid="steamos-native-topbar"
            className="w-full h-[40px] px-5 flex items-center justify-end gap-3 text-xs text-slate-200 font-semibold absolute top-0 left-0 right-0 z-30 pointer-events-none"
          >
            <span className="text-slate-300">Wi-Fi</span>
            <span className="flex items-center gap-1">
              <span>92%</span>
              <span className="inline-block w-4 h-2.5 rounded-sm bg-emerald-400 border border-emerald-200" />
            </span>
            <span>13:40</span>
            <span className="w-6 h-6 rounded-full bg-[#389fff] text-white flex items-center justify-center text-[10px] font-bold">
              D
            </span>
          </div>

          {/* Screen Body */}
          <div className="flex-1 relative overflow-hidden flex">
            {viewMode === 'dashboard' ? (
              <div className="w-full h-full overflow-hidden flex flex-col [&>div]:!h-full">
                <FullDashboardPage />
              </div>
            ) : (
              <>
                {/* Background Game Art Placeholder */}
                <div className="flex-1 bg-gradient-to-br from-[#121923] via-[#0d131c] to-[#080c11] flex items-center justify-center text-slate-600 text-xs select-none">
                  <span>SteamOS Game / Home Background (1280×800)</span>
                </div>

                {/* Exact Steam Deck QAM Panel: 340px total (48px icon rail + 292px Decky pane) */}
                <aside
                  data-testid="steamos-qam-drawer"
                  className="w-[340px] h-full pt-[40px] pb-[36px] flex-shrink-0 bg-[#1a222d]/95 border-l border-[#2e3d52] flex shadow-2xl"
                >
                  {/* Left 48px SteamOS QAM Icon Rail */}
                  <div className="w-[48px] flex-shrink-0 bg-[#141b24] border-r border-[#2a384b] flex flex-col items-center py-3 gap-4 text-slate-400 text-xs">
                    <span>🔔</span>
                    <span>👥</span>
                    <span>⚙️</span>
                    <span>⚡</span>
                    <span>🎵</span>
                    <span>❓</span>
                    <span className="w-full py-2 bg-[#2a384b] text-white text-center border-l-2 border-[#389fff]">
                      🔌
                    </span>
                  </div>

                  {/* Right 292px Decky Plugin Pane */}
                  <div className="w-[292px] flex-shrink-0 flex flex-col h-full overflow-hidden">
                    <div className="h-[44px] flex-shrink-0 px-3 flex items-center gap-3 border-b border-[#2a384b]/70">
                      <span className="px-2 py-0.5 rounded-full bg-[#3a4759] text-white text-xs font-bold">
                        ←
                      </span>
                      <span className="text-sm font-bold text-slate-100">Next Unlock</span>
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
                      <DeckyContent />
                    </div>
                  </div>
                </aside>
              </>
            )}
          </div>

          {/* SteamOS Floating Bottom Footer Overlay (36px) */}
          <div className="w-full h-[36px] px-5 flex items-center justify-between text-[11px] font-semibold text-slate-300 bg-[#0b1016]/85 backdrop-blur-sm border-t border-[#2e3d52]/40 absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[#0b1016] font-extrabold text-[10px]">
                STEAM
              </span>
              <span className="text-slate-300">MENU</span>
            </div>
            <div className="flex items-center gap-5">
              <span>
                <span className="inline-block px-1.5 py-0.2 rounded-full bg-slate-200 text-[#0b1016] font-bold mr-1">
                  A
                </span>
                SELECT
              </span>
              <span>
                <span className="inline-block px-1.5 py-0.2 rounded-full bg-slate-200 text-[#0b1016] font-bold mr-1">
                  B
                </span>
                BACK
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <HarnessApp />
    </React.StrictMode>
  );
}
