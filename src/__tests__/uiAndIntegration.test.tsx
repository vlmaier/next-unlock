import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeckyContent, FullDashboardPage } from '../components/PluginRoot';
import { __setCallFn, clearApiCache } from '../services/steamApi';
import { MockSteamClientService } from '../services/mockSteamClient';
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('UI Surfaces, No-Active-Game Mode & Full-Stack Python Integration', () => {
  beforeEach(() => {
    clearApiCache();
    MockSteamClientService.reset();
    if (typeof window !== 'undefined') {
      (window as any).Router = { MainRunningApp: undefined };
    }
  });

  it('works in QAM without an active running game and shows Game Selector + Full Dashboard button', async () => {
    __setCallFn(null);

    render(<DeckyContent />);

    await waitFor(() => {
      expect(screen.getByText('Elden Ring')).toBeTruthy();
    });

    // Game selector dropdown is rendered even when no game is running
    const selectEl = screen.getByLabelText('Installed Game') as HTMLSelectElement;
    expect(selectEl).toBeTruthy();
    expect(selectEl.value).toBe('1245620');

    // Open Full Dashboard & Refresh buttons are always rendered
    expect(screen.getByText('Open Full Dashboard')).toBeTruthy();
    expect(screen.getByText('Refresh Achievements')).toBeTruthy();

    // Up Next recommends Rykard (35.8% Easy Grab) and Legendary Armaments (8/9 progress) ahead of Malenia (4.1%)
    expect(screen.getByText('Rykard, Lord of Blasphemy')).toBeTruthy();
    expect(screen.getByText('Legendary Armaments')).toBeTruthy();
  });

  it('handles switching to a game with 0 achievements without losing the Game Selector', async () => {
    __setCallFn(async (method: string, ...args: any[]) => {
      if (method === 'get_pinned') return [];
      if (method === 'get_games') {
        const base = await MockSteamClientService.getGames();
        return [
          ...base,
          {
            appid: 999999,
            name: 'Prototype Without Achievements',
            header_image: '',
            total_achievements: 0,
            unlocked_count: 0,
            completion_percentage: 0,
            achievements: [],
          },
        ];
      }
      if (method === 'get_game_details') {
        const appid = Number(args[0]);
        if (appid === 999999) {
          return {
            game: {
              appid: 999999,
              name: 'Prototype Without Achievements',
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
      return null;
    });

    render(<DeckyContent />);

    await waitFor(() => {
      expect(screen.getByText('Elden Ring')).toBeTruthy();
    });

    const selectEl = screen.getByLabelText('Installed Game') as HTMLSelectElement;
    fireEvent.change(selectEl, { target: { value: '999999' } });

    await waitFor(() => {
      expect(screen.getByText('No Steam Achievements')).toBeTruthy();
    });

    // Game selector dropdown is STILL available so the user can switch back!
    expect(screen.getByLabelText('Installed Game')).toBeTruthy();
    expect(screen.getByText('Open Full Dashboard')).toBeTruthy();
  });

  it('renders FullDashboardPage cleanly without duplicate headers, fake Strategy popups, or fake Unlock buttons', async () => {
    __setCallFn(null);

    render(<FullDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('achievement-card-ACH_GODDEVOURING_SERPENT')).toBeTruthy();
    });

    // Verify no vibe-coded Strategy button or fake Unlock button exists
    expect(screen.queryByText('Strategy')).toBeNull();
    expect(screen.queryByText('Hide Strategy')).toBeNull();
    expect(screen.queryByText('Unlock')).toBeNull();

    // Verify clicking a locked card pins it immediately and updates the Pinned tab count
    const rykardCard = screen.getByTestId('achievement-card-ACH_GODDEVOURING_SERPENT');
    fireEvent.click(rykardCard);

    await waitFor(() => {
      const pinnedTab = screen.getByTestId('category-tab-pinned');
      expect(pinnedTab.textContent).toContain('2');
    });

    // Verify Steam Achievement Sets bar is rendered and filters by Base Game vs DLC Set
    const baseSetPill = screen.getByTestId('achievement-set-0');
    const dlcSetPill = screen.getByTestId('achievement-set-1');
    expect(baseSetPill.textContent).toContain('Base Game');
    expect(dlcSetPill.textContent).toContain('Shadow of the Erdtree');

    fireEvent.click(dlcSetPill);
    await waitFor(() => {
      const allTab = screen.getByTestId('category-tab-all');
      expect(allTab.textContent).toContain('2');
      expect(screen.queryByTestId('achievement-card-ACH_MARGIT')).toBeNull();
      expect(screen.getByTestId('achievement-card-ACH_MALENIA')).toBeTruthy();
      expect(screen.getByTestId('guide-btn-ACH_MALENIA')).toBeTruthy();
    });

    // Verify 1-click Reveal Secrets toggle reveals hidden achievement title & Guide button
    const revealAllBtn = screen.getByTestId('toggle-reveal-secrets-btn');
    fireEvent.click(revealAllBtn);
    await waitFor(() => {
      expect(screen.getByText('Age of the Stars')).toBeTruthy();
      expect(screen.getByTestId('guide-btn-ACH_AGE_OF_STARS')).toBeTruthy();
    });

    // Switch to All Games Overview and verify "Closest to 100% Ribbon" Advisor
    fireEvent.click(screen.getByTestId('game-pill-all'));
    await waitFor(() => {
      expect(screen.getByText('Closest to 100% Ribbon')).toBeTruthy();
      expect(screen.getByTestId('ribbon-advisor-1245620-set-0')).toBeTruthy();
    });

    // Clicking the Ribbon Advisor card jumps directly to Elden Ring's Base Game set (4 achievements)
    fireEvent.click(screen.getByTestId('ribbon-advisor-1245620-set-0'));
    await waitFor(() => {
      const allTab = screen.getByTestId('category-tab-all');
      expect(allTab.textContent).toContain('4');
      expect(screen.getByText('Base Game Achievements')).toBeTruthy();
      expect(screen.getByTestId('missable-badge-ACH_LEGENDARY_ARMAMENTS')).toBeTruthy();
      expect(screen.getByTestId('missable-reason-ACH_LEGENDARY_ARMAMENTS').textContent).toContain(
        'Bolt of Gransax'
      );
    });

    // Clicking the Hero Missable Radar button filters strictly to locked missable achievements
    fireEvent.click(screen.getByTestId('missable-radar-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('achievement-card-ACH_LEGENDARY_ARMAMENTS')).toBeTruthy();
      expect(screen.queryByTestId('achievement-card-ACH_GODDEVOURING_SERPENT')).toBeNull();
    });
  });

  it('integrates end-to-end with the real Python backend (scripts/rpc_cli.py)', async () => {
    const tmpSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'next-unlock-e2e-'));
    const scriptPath = path.resolve(__dirname, '../../scripts/rpc_cli.py');

    try {
      __setCallFn(async (method: string, ...args: any[]) => {
        const payload = JSON.stringify({ method, args });
        const stdout = execFileSync('python3', [scriptPath, payload], {
          env: {
            ...process.env,
            NEXT_UNLOCK_SANDBOX_DIR: tmpSandbox,
            NEXT_UNLOCK_RUNNING_APPID: 'none',
          },
          encoding: 'utf-8',
        });
        const parsed = JSON.parse(stdout);
        return parsed.result;
      });

      render(<FullDashboardPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Elden Ring').length).toBeGreaterThan(0);
      });

      // Verify Python backend returned all seeded games including the 0-achievement game
      expect(screen.getByTestId('game-pill-1245620')).toBeTruthy();
      expect(screen.getByTestId('game-pill-1091500')).toBeTruthy();
      expect(screen.getByTestId('game-pill-999999')).toBeTruthy();

      // Switch to Cyberpunk 2077 via game pill and verify its achievements load from Python
      fireEvent.click(screen.getByTestId('game-pill-1091500'));
      await waitFor(() => {
        expect(screen.getByText('Autorestart')).toBeTruthy();
      });
    } finally {
      fs.rmSync(tmpSandbox, { recursive: true, force: true });
    }
  });
});
