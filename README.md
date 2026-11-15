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

## Why Install Next Unlock? (Beyond Native Steam Achievements)

While Valve's Steam Achievements update improved the full-page library view and introduced **Achievement Sets**, native SteamOS still lacks what achievement hunters need mid-game on a Steam Deck:

1. **Missable & Unobtainable "No-Paranoia Radar"**: Warns you when a game or Achievement Set has **Missable** achievements (with 1-line point-of-no-return cutoff warnings like *"Must collect Bolt of Gransax in Leyndell before defeating Maliketh"*) or **Unobtainable** broken achievements — powered by a 3-tier hybrid resolver (Curated + `achievement-scavenger-database` CDN, top-rated Steam Guide `Missable` section parser, and SteamHunters API).
2. **In-Game `•••` Quick Access Pin Tracker (`Pinned Targets`)**: Pin the 2–3 achievements you are actively hunting and check their live multi-step progress (`8 / 9`) with a single press of the `•••` button — without leaving your game or scrolling through 80+ achievements.
3. **Actionable `Up Next` Recommendation Engine**: Native Steam only sorts by unlock time or raw rarity. Next Unlock combines your partial multi-step progress (`Almost There`, $\ge 50\%$), global unlock rate (`Easy Grabs`, $\ge 25\%$), and visibility to tell you what to unlock next.
4. **"Closest to 100% Ribbon" Library & Set Advisor**: Scans your entire installed Steam Deck library (and individual **Base Game / DLC Achievement Sets**) to surface the fastest path to your next 100% completion badge.
5. **1-Click Secret Spoiler Reveal & Steam Guide Lookup**: Reveal hidden achievement descriptions directly from Valve's `schema_v2` data in `0ms` and open top-rated Steam Community Guides for any locked achievement in one click.
6. **Full Steam Achievement Sets & DLC Artwork Support**: Native support for Valve's `schema_v2` Achievement Sets (`Base Game`, `DLC` expansions with official DLC store artwork, thematic update sets, and `Archived` retired achievements).
