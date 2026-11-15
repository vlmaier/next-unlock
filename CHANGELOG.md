# [2.0.0](https://github.com/vlmaier/next-unlock/compare/v1.3.2...v2.0.0) (2026-11-15)


* feat!: Next Unlock 2.0.0 architecture, recommendation engine, and SteamOS UX overhaul ([da42495](https://github.com/vlmaier/next-unlock/commit/da42495bdde8d7c9c50dbafaa61d654bf0aca7f5))


### Bug Fixes

* **ci:** compile generated.css before vitest and split CI & Release jobs ([b21827a](https://github.com/vlmaier/next-unlock/commit/b21827ae08443c21c25782b8bb5a4a422ed1554c))


### BREAKING CHANGES

* Complete 2.0 architecture with canonical recommendation scoring, Valve SSR + gzip achievement scraper, strict Python TypedDict models, synchronous 0ms cache hydration, native SteamOS Slate UI, one-command Steam Deck installer, and semantic-release automation.
