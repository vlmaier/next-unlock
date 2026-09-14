# Next Unlock

> Smart achievement companion & progress dashboard for Steam Deck (Decky Loader plugin).

---

## Installation

Run in Steam Deck Desktop Mode terminal (Konsole):

```bash
curl -L https://raw.githubusercontent.com/vlmaier/next-unlock/main/next-unlock.zip -o /tmp/next-unlock.zip && unzip -o /tmp/next-unlock.zip -d ~/homebrew/plugins/ && sudo systemctl restart plugin_loader
```

---

## Development

```bash
# Install dependencies
pnpm install

# Run unit test suites (Frontend Vitest + Python unittest)
pnpm test

# Build production plugin bundle
pnpm run build
```

---

## Features

- **Smart Filtering**: Up Next, Almost There, Easy Grabs, Missable, Pinned, Unlocked.
- **Dual UI Modes**: 320px Quick Access Menu (QAM) drawer & fullscreen dashboard.
- **5 Dark Themes**: Valve DeckOS, PlayStation Platinum, GOG Galaxy, Nordic Espresso, Stealth Monochrome OLED.
- **Clean UI**: Strict AAA dark mode aesthetics & SVG iconography (Lucide).
