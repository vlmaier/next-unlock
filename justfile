# Next Unlock — SDLC Task Runner (justfile)
# Uses Astral Python toolchain (uv, ruff, ty, pytest) + pnpm (TypeScript, Vitest, Rollup)

set shell := ["zsh", "-cu"]
export PATH := env_var("HOME") + "/.local/bin:/opt/homebrew/bin:" + env_var("PATH")

default:
    @just --list

# Install / sync both Node (pnpm) and Python (uv) dependencies
setup:
    pnpm install --frozen-lockfile
    uv sync

# Start full-stack SteamOS / Decky local emulator (Vite + live Python main.py RPC bridge)
dev:
    pnpm run build
    pnpm run dev

# Format Python code with Astral ruff
fmt:
    uv run ruff format main.py backend scripts
    uv run ruff check --fix main.py backend scripts

# Lint Python (ruff) and check formatting
lint:
    uv run ruff check main.py backend scripts
    uv run ruff format --check main.py backend scripts

# Typecheck Python (Astral ty) and TypeScript (tsc)
typecheck:
    uv run ty check main.py backend scripts
    pnpm run typecheck

# Run Python backend unit & fixture tests with coverage (pytest)
test-py:
    uv run pytest

# Run Frontend unit, component, and full-stack integration tests (vitest)
test-ts:
    pnpm test

# Run all test suites (Python + TypeScript + Integration)
test: test-py test-ts

# Build production Tailwind CSS + Rollup Decky bundle (dist/index.js)
build:
    pnpm run build

# Run post-build Decky CEF bundle smoke test on dist/index.js
smoke: build
    pnpm run smoke

# Package next-unlock.zip cleanly and verify structure & versions
package: smoke
    rm -rf build_stage next-unlock.zip
    mkdir -p build_stage/next-unlock
    cp -r dist main.py plugin.json package.json README.md pyproject.toml build_stage/next-unlock/
    mkdir -p build_stage/next-unlock/backend
    cp backend/*.py build_stage/next-unlock/backend/
    cd build_stage && zip -r -q ../next-unlock.zip next-unlock
    rm -rf build_stage
    uv run python scripts/verify_release_zip.py next-unlock.zip

# Mandatory pre-release & pre-commit quality gate
verify: lint typecheck test package
    @echo "✅ All SDLC quality gates (ruff, ty, tsc, pytest, vitest, bundle smoke, zip verify) passed!"
