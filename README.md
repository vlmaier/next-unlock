# Next Unlock 🏆
> **Smart Achievement Companion & Priority Roadmap Plugin for Steam Deck**

**Author**: Vladas Maier  
**Plugin Version**: `v1.0.0`

---

## Features

- **Smart Achievement Categorization**:
  - **Up Next**: AI/Rule-ranked recommendations based on completion rate & proximity.
  - **Almost There**: Achievements with $\ge 75\%$ progress bars ready to complete.
  - **Easy Grabs**: High global unlock percentage ($\ge 30\%$) or short estimated completion times.
  - **Missable / Hidden**: Flags secret story achievements and missable progression triggers.
  - **Pinned**: Quick Access drawer pinning for active achievement hunting.
- **5 Designer-Curated Dark Themes**:
  - **Valve DeckOS Slate**: Authentic Steam Deck Gaming Mode dark slate.
  - **PlayStation Platinum**: Cobalt & trophy dark.
  - **GOG Galaxy Midnight**: Minimalist European graphite.
  - **Nordic Espresso**: Cozy dark timber & stone.
  - **Stealth Monochrome**: Deep OLED black & titanium charcoal.
- **Steam Deck QAM & Desktop Test Harness**:
  - Compact 320px Quick Access Drawer view.
  - Fullscreen Dashboard overlay.

---

## 1-Line Installation on Steam Deck

Switch to **Desktop Mode**, open **Konsole** (terminal), and run:

```bash
curl -L https://github.com/vlmaier/next-unlock/releases/latest/download/next-unlock.zip -o /tmp/next-unlock.zip && unzip -o /tmp/next-unlock.zip -d ~/homebrew/plugins/ && sudo systemctl restart plugin_loader
```

Then return to **Gaming Mode**. Press the `...` (Quick Access) button and open Decky Loader to access **Next Unlock**.

---

## Development & Local Test Harness

To test locally on Mac/PC without a Steam Deck:

```bash
# Install dependencies
npm install

# Start desktop dev test harness
npm run dev

# Build production bundle
npm run build
```

---

## Releasing New Versions (GitHub Releases)

To create a new release on GitHub:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will automatically build `dist/`, package `next-unlock.zip`, and publish the release asset to [GitHub Releases](https://github.com/vlmaier/next-unlock/releases).
