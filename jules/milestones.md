# PixiAni — Milestones (plans 001–022)

Date: 2025-09-12

This milestone file expands the phase report into a per-plan table that captures: plan objective, concrete deliverables, key files touched, status, how it was verified, and recommended next actions.

| Plan | Title (short) | Deliverables | Key files / locations | Status | Verification | Notes / Next actions |
|------|---------------|--------------|-----------------------|--------|--------------|----------------------|
| 001 | Project init & skeleton | Project layout, package scripts, basic assets | `package.json`, `tsconfig.json`, `src/`, `tests/`, `demo/`, `assets/` | Done | Manual + tests run during later plans | Keep scripts updated as deps change. |
| 002 | Core types & modules | `types.ts`, `BaseObject`, `BaseAnimate`, `AnimationManager` | `src/core/types.ts`, `src/core/BaseObject.ts`, `src/core/BaseAnimate.ts`, `src/core/AnimationManager.ts` | Done | Unit tests in `tests/core/*` | Consider documenting public API in `README`/typedocs. |
| 003 | First concrete animation | `ScaleAnimation` implementation | `src/animations/ScaleAnimation.ts`, `tests/animations/ScaleAnimation.test.ts` | Done | Vitest unit tests | Add more edge-case tests (zero sprites, large deltaTime). |
| 004 | Unit-test harness | Vitest config, core tests | `vitest.config.ts`, `tests/core/*` | Done | `npm run test` (passes) | Run coverage checks periodically. |
| 005 | Demo page & playback UI | Demo page showing animation playback controls | `demo/index.html`, `demo/main.ts` | Done | Manual UI test + automation reported | Add e2e tests later. |
| 006 | Library build pipeline | Library mode build config | `vite.lib.config.ts`, `dist/` outputs | Done | `npm run build` | Add release notes and versioning. |
| 007 | Final review & docs | `jules.md`, AGENTS doc, plan files scaffolded | `jules/README.md`, `AGENTS.md`, `jules/*.md` | Done | Document reviews (reports generated) | Keep `AGENTS.md` synced with workflow changes. |
| 008 | Fade animation | `FadeAnimation` + tests + docs | `src/animations/FadeAnimation.ts`, `tests/animations/FadeAnimation.test.ts`, `howtowriteani.md` | Done (report present) | Unit tests passed (report) | `plan008.md` missing; report exists — keep record. |
| 009 | ComplexPop animation | `ComplexPopAnimation` + tests | `src/animations/ComplexPopAnimation.ts`, `tests/animations/ComplexPopAnimation.test.ts` | Done | Unit tests passed | None. |
| 010 | FlagWave (mesh) | Mesh-based waving animation, API updates for v8 | `src/animations/FlagWaveAnimation.ts`, mocks in tests | Done | Unit tests + build | Verified Pixi v8 API changes handled. |
| 011 | Vortex / BlackHole animation | Mesh vortex effect + tests | `src/animations/VortexAnimation.ts`, `tests/animations/VortexAnimation.test.ts` | Done | Unit tests + demo preview | None. |
| 012 | Editor feature enhancement | UI components, asset selection, loop/speed controls | `editor/web/components/*`, `editor/server.ts`, asset endpoints | Done | Manual + unit tests; demo | Consider accessibility review of UI. |
| 013 | Gemini TDD workflow | Tools for agent: read/list/create/update files, run tests | `editor/server.ts` (tools), `.sessions/` usage, `run_tests` | Done | End-to-end TDD reported | Add throttling/limits for multi-tenant use. |
| 014 | Autonomous streaming workflow | SSE-based streaming, agent loop with step limit | `editor/server.ts` (SSE), `editor/web/components/App.tsx` (EventSource) | Done | Manual integration tests | Confirm URL-length safety for GET prompts; consider POST+stream alternative for long prompts. |
| 015 | Fix sandboxed test exec | Make vitest discover session tests; structured SYSTEM_ERROR | `vitest.config.ts` (include globs), `editor/server.ts` (run_tests) | Done | Verified with sample session tests | Monitor for other vitest config edge cases. |
| 016 | Module alias resolution | Ensure `pixi-animation-library` resolves in sandboxed runs | `editor/server.ts` (vitest --config), `demo/vite.config.ts` | Done | Tested by running vitest with `--config demo/vite.config.ts` | Consider consolidating alias into root config for clarity. |
| 017 | Race condition fix | Send `filePath` in workflow_complete and import directly | `editor/server.ts`, `editor/web/components/App.tsx` | Done | Manual + reproduction tests | None. |
| 018 | Core lifecycle bug fix | Fix `BaseAnimate.setState` and onComplete loop logic | `src/core/BaseAnimate.ts`, tests updated | Done | Unit tests and reproduced agent test | Add regression test for loop/onComplete semantics. |
| 019 | Staging area (safety) | `.sessions/<id>/staging/` workflow; publish-on-success | `editor/server.ts` (staging, publish_files), `.sessions/` structure | Done | Manual + integration tests | Protect staging from large disk usage; cleanup policy. |
| 020 | Stale-file fix | Delete-then-write strategy to avoid caching | `editor/server.ts` (write_file), file utils | Done | Verified by repeated agent fix cycles | Consider fsync or small delay if needed on slow filesystems. |
| 021 | System error reporting | Include stdout/stderr in `SYSTEM_ERROR:` outputs | `editor/server.ts` (`run_tests`) | Done | Manual test simulating env error | Ensure logs redact secrets before returning. |
| 022 | Standardize import strategy | Mandate alias for library, relative import for class-under-test | `src/index.ts` exports verified, `editor/server.ts` prompt text | Done | Unit tests + sandboxed runs | Keep `src/index.ts` exports up-to-date when adding core APIs. |

## Cross-cutting recommendations (actionable)
- Add `jules/milestones.md` link into `jules/README.md` and optionally the repo root `README.md` so reviewers easily find this table.
- Add a lightweight GH Action that runs a minimal agent TDD cycle daily/for PRs to detect environment regressions early.
- Implement a cleanup/TTL policy for `.sessions/` to avoid accumulating large amounts of staged artifacts.
- Consider centralizing Vite/Vitest alias config at repo root to reduce cross-config complexity.

---

If you'd like, I can now:
- Insert a link to this milestones file into `jules/README.md`,
- Or create a short changelog entry in the repo root `README.md` summarizing these milestones.
