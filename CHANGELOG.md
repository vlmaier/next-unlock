## [2.3.3](https://github.com/vlmaier/next-unlock/compare/v2.3.2...v2.3.3) (2026-11-15)


### Bug Fixes

* replace recursive SD-card mount globs with shallow globs so get_games never times out ([8edc1e1](https://github.com/vlmaier/next-unlock/commit/8edc1e1c687db3ffd54085238954e993e9ef1edc))

## [2.3.2](https://github.com/vlmaier/next-unlock/compare/v2.3.1...v2.3.2) (2026-11-15)


### Bug Fixes

* use atomic cache writes to prevent concurrent JSON corruption ([af9ee6a](https://github.com/vlmaier/next-unlock/commit/af9ee6ac518cf35f8812a40d8eda5c060b772ee0))

## [2.3.1](https://github.com/vlmaier/next-unlock/compare/v2.3.0...v2.3.1) (2026-11-15)


### Bug Fixes

* resolve Steam Deck QAM overflow, top-bar overlap, achievement deduplication, hash-prefixed DLC assets, English guides, and full-library sync ([1a55c7b](https://github.com/vlmaier/next-unlock/commit/1a55c7b983dbe345ccf213157ac5e7c64baccd46))

# [2.3.0](https://github.com/vlmaier/next-unlock/compare/v2.2.0...v2.3.0) (2026-11-15)


### Features

* add 3-tier Missable & Unobtainable achievement radar with point-of-no-return cutoff warnings ([430cfc4](https://github.com/vlmaier/next-unlock/commit/430cfc4762877e45995b493750b83c395c3fab05))

# [2.2.0](https://github.com/vlmaier/next-unlock/compare/v2.1.0...v2.2.0) (2026-11-15)


### Features

* add DLC set artwork, 1-click secret reveal & Steam Guide lookup, and Closest to 100% Ribbon advisor ([55fcc69](https://github.com/vlmaier/next-unlock/commit/55fcc6926f89f9764fc48d001d2f24e9de8e0938))

# [2.1.0](https://github.com/vlmaier/next-unlock/compare/v2.0.0...v2.1.0) (2026-11-15)


### Features

* add Steam Achievement Sets support (Base Game, DLC sets, and Archived achievements) ([2c14794](https://github.com/vlmaier/next-unlock/commit/2c1479462f0e7d9a0f92e24c4c22aa748244b38d))

# [2.0.0](https://github.com/vlmaier/next-unlock/compare/v1.3.2...v2.0.0) (2026-11-15)


* feat!: Next Unlock 2.0.0 architecture, recommendation engine, and SteamOS UX overhaul ([da42495](https://github.com/vlmaier/next-unlock/commit/da42495bdde8d7c9c50dbafaa61d654bf0aca7f5))


### Bug Fixes

* **ci:** compile generated.css before vitest and split CI & Release jobs ([b21827a](https://github.com/vlmaier/next-unlock/commit/b21827ae08443c21c25782b8bb5a4a422ed1554c))


### BREAKING CHANGES

* Complete 2.0 architecture with canonical recommendation scoring, Valve SSR + gzip achievement scraper, strict Python TypedDict models, synchronous 0ms cache hydration, native SteamOS Slate UI, one-command Steam Deck installer, and semantic-release automation.
