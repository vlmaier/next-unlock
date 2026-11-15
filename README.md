# Next Unlock

> Smart achievement companion & progress dashboard for Steam Deck (Decky Loader plugin).

---

## One-Command Steam Deck Installation & Update

Run this single command in **Steam Deck Desktop Mode (Konsole)** or over **SSH** — no prerequisites required, and any existing installation is updated automatically while preserving your pinned achievements:

```bash
curl -fsSL https://raw.githubusercontent.com/vlmaier/next-unlock/main/install.sh | sh
```

### Offline / Manual Zip Installation

If you downloaded `next-unlock.zip` from [GitHub Releases](https://github.com/vlmaier/next-unlock/releases) manually:

```bash
sudo rm -rf ~/homebrew/plugins/next-unlock && sudo unzip -o ~/Downloads/next-unlock.zip -d ~/homebrew/plugins/ && sudo chmod -R 755 ~/homebrew/plugins/next-unlock && sudo systemctl restart plugin_loader
```

---

## Development & Pre-Steam Deck Emulator (`just` + Astral Python + Vite)

We use [`just`](https://github.com/casey/just), the Astral Python suite (`uv`, `ruff`, `ty`, `pytest`), and `pnpm` (`tsc`, `vitest`, `rollup`).

```bash
# Install Node & Python dependencies
just setup

# Start the live SteamOS & Decky Loader browser emulator (http://127.0.0.1:5173/)
just dev

# Run the full SDLC verification gate (ruff, ty, tsc, pytest, vitest, bundle smoke, zip verify)
just verify

# Build and verify release zip (next-unlock.zip)
just package
```

---

## Features

- **Actionable Recommendation Engine (`Up Next`)**: Prioritizes achievements with active multi-step progress (`Almost There`, $\ge 50\%$) and high global unlock rates (`Easy Grabs`, $\ge 25\%$) over ultra-rare grinds.
- **Works With or Without an Active Game**: Browse your entire installed Steam library from the Quick Access Menu (`320px` drawer) or the Fullscreen Dashboard (`/next-unlock`), even when no game is running.
- **0ms Synchronous Cache Recall**: Instantaneous UI rendering from in-memory + `localStorage` + disk caches with immediate background refresh and pin synchronization.
- **Native SteamOS Slate UX**: Controller-first `Focusable` navigation, uncropped `460:215` Steam store capsules, and clean SteamOS typography.
