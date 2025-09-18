# Repository Guidelines

## Project Structure & Module Organization
- `packages/pixiani-engine` contains the core runtime, managers, and shared types (`src/core` for logic, `src/core/types.ts` for interfaces, `tests` mirroring the `src` tree).
- `packages/pixiani-anis` houses reusable animations under `src/animations`, with companion specs in `tests/animations`.
- `apps` hosts runnable surfaces such as the Gemini editor (`apps/editor`) and demo targets filtered via Turborepo. Shared assets live in `assets/`, while build outputs land in `dist/`.

## Build, Test, and Development Commands
- `pnpm install` bootstraps the monorepo workspace.
- `pnpm dev` runs all app dev servers; use `pnpm dev:editor` for the editor only.
- `pnpm build` executes the Turborepo build across packages and apps.
- `pnpm test` invokes Vitest on every workspace; `pnpm coverage` adds Istanbul reports.
- `pnpm lint` enforces the ESLint config defined in `eslint.config.mjs`.

## Coding Style & Naming Conventions
- TypeScript is strict; declare explicit parameter, return, and property types. Avoid `any` unless justified in a comment.
- Follow Pixi.js-oriented modularity: keep files focused, prefer small classes or functions, and colocate helpers near their consumers.
- Use camelCase for functions/variables, PascalCase for classes and React-style components, and kebab-case for file names unless exporting a class (`SpriteAnimator.ts`).
- Document exported symbols with JSDoc explaining rationale or non-obvious behaviour.

## Testing Guidelines
- Write Vitest suites beside their targets (`packages/pixiani-engine/tests/path/to/file.test.ts`).
- Target ≥90% coverage for core logic; run `pnpm coverage` before submitting substantial changes.
- Prefer deterministic fixtures and mock Pixi.js dependencies when possible.

## Commit & Pull Request Guidelines
- Adopt Conventional Commit prefixes (e.g., `feat:`, `fix:`, `refactor:`) as seen in recent history.
- Squash work into meaningful commits with descriptive bodies when behaviour changes.
- PRs should describe intent, outline testing (`pnpm build`, `pnpm test`), and link tracking issues. Include screenshots or GIFs for visual changes.

## Agent-Specific Notes
- Read `jules.md` and relevant `*.plan.md` files before coding.
- Keep the plan tool updated during multi-step tasks, and never overwrite user changes you did not author.
