# Plan: Refactor to pnpm, Turborepo, and Monorepo

## 1. Goal

Refactor the project to use `pnpm` and `Turborepo` and restructure it into a monorepo.

- Use `pnpm` for package management.
- Use `Turborepo` to manage the monorepo.
- Core animation logic (`src`) will become a separate package `pixiani-core` under `packages/`.
- `demo` and `editor` will become separate applications under `apps/`.
- `demo` and `editor` will depend on `pixiani-core`.
- All npm scripts will be managed by `Turborepo`.

## 2. Task Breakdown

### Step 1: Project Setup and Scaffolding

1.  **Create `pnpm-workspace.yaml`:** Define the workspace to include `apps/*` and `packages/*`.
2.  **Create `turbo.json`:** Set up the initial Turborepo configuration.
3.  **Create directory structure:** Create `apps/` and `packages/` directories.

### Step 2: Create `pixiani-core` Package

1.  **Move source files:** Move the existing `src/` directory to `packages/pixiani-core/src`.
2.  **Move test files:** Move the existing `tests/` directory to `packages/pixiani-core/tests`.
3.  **Create `package.json`:** Create a `package.json` for `pixiani-core`.
    - It will contain dependencies like `pixi.js`.
    - It will have its own build and test scripts.
4.  **Create `tsconfig.json`:** Create a `tsconfig.json` for the `pixiani-core` package.
5.  **Update `vite.lib.config.ts`:** Move and update the vite config for building the library.

### Step 3: Create `demo` and `editor` Apps

1.  **Move `demo` app:** Move the `demo/` directory to `apps/demo`.
2.  **Move `editor` app:** Move the `editor/` directory to `apps/editor`.
3.  **Create `package.json` for each app:**
    - `apps/demo/package.json` will depend on `pixiani-core` using `workspace:*`.
    - `apps/editor/package.json` will also depend on `pixiani-core` using `workspace:*`.
    - Dependencies from the root `package.json` will be moved to the respective app's `package.json`.
4.  **Create `tsconfig.json` for each app.**
5.  **Update vite configs:** Update `vite.config.ts` in both `demo` and `editor` to work within the monorepo.

### Step 4: Refactor Root Configuration

1.  **Update root `package.json`:**
    - Remove dependencies that were moved to individual packages.
    - Keep workspace-wide dev dependencies like `typescript`, `vitest`, `prettier`, and `eslint`.
    - Update scripts to use `turbo`. For example, `turbo run build`, `turbo run test`.
2.  **Update root `tsconfig.json`:** Create a base `tsconfig.json` that other packages can extend.
3.  **Update `AGENTS.md`:** Update instructions to use `pnpm` and `turbo`.
4.  **Delete `package-lock.json`** and install dependencies with `pnpm`.

### Step 5: Verification and Cleanup

1.  **Install dependencies:** Run `pnpm install` at the root.
2.  **Run build:** Run `pnpm build` (which will trigger `turbo run build`) and ensure all packages build correctly.
3.  **Run tests:** Run `pnpm test` (which will trigger `turbo run test`) and ensure all tests pass.
4.  **Run demo and editor:** Verify that the `dev` scripts for both `demo` and `editor` apps work as expected.
5.  **Cleanup:** Remove any old, now unused, configuration files from the root.

### Step 6: Documentation

1.  **Create report:** Create `jules/plan024-report.md` detailing the process.
2.  **Update `jules.md`:** Update the main development document to reflect the new monorepo structure, build process, and development workflow.
3.  **Update `AGENTS.md`:** Ensure the agent instructions are up-to-date with the new commands and structure.
