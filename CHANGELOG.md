# [2.5.0](https://github.com/vlmaier/next-unlock/compare/v2.4.1...v2.5.0) (2026-11-15)


### Features

* add LB/RB category switching, LT/RT game switching, and controller-accessible X/D-pad Guide navigation ([65f8333](https://github.com/vlmaier/next-unlock/commit/65f8333f6c75e2ad8931cce55328d30b28db9a8c))

## [2.4.1](https://github.com/vlmaier/next-unlock/compare/v2.4.0...v2.4.1) (2026-11-15)


### Bug Fixes

* increase get_game_details RPC timeout to 20s so cold Steam fetches with DLCs and hash headers complete ([219d95d](https://github.com/vlmaier/next-unlock/commit/219d95d741ca27840fce975bd485c9a09d579def))
* match Focusable focus ring to exact button/card shape and prevent guide language mismatch ([301bd6e](https://github.com/vlmaier/next-unlock/commit/301bd6ee3333a93097103f44fa2e5eb339a5da63))

# [2.4.0](https://github.com/vlmaier/next-unlock/compare/v2.3.6...v2.4.0) (2026-11-15)


### Features

* merge SteamOS collectionStore/appStore owned library games so all 242+ games sync ([1840f2c](https://github.com/vlmaier/next-unlock/commit/1840f2cb2c67bfc86e2cbf070366b2d898aadd4b))

## [2.3.6](https://github.com/vlmaier/next-unlock/compare/v2.3.5...v2.3.6) (2026-11-15)


### Bug Fixes

* prevent Full Dashboard GameSelector pills from shrinking vertically inside scroll container ([cbe9964](https://github.com/vlmaier/next-unlock/commit/cbe996478ea67f82fe62884df83607e683ff5a13))

## [2.3.5](https://github.com/vlmaier/next-unlock/compare/v2.3.4...v2.3.5) (2026-11-15)


### Bug Fixes

* pin Full Dashboard header below SteamOS top bar, remove double focus rings, and remove QAM separator line above progress bar ([6606c75](https://github.com/vlmaier/next-unlock/commit/6606c7550a5147c01e988353fae246272d0ab2dd))

## [2.3.4](https://github.com/vlmaier/next-unlock/compare/v2.3.3...v2.3.4) (2026-11-15)


### Bug Fixes

* use full-width QAM dropdowns and exact 1280x800 Steam Deck emulator layout ([99e06e2](https://github.com/vlmaier/next-unlock/commit/99e06e27268e9c2918164266c9e9b2d8f794f6c7))

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
