# Plan: Refactor to pnpm, Turborepo, and Monorepo

## 1. Goal

Refactor the project to use `pnpm` and `Turborepo` and restructure it into a monorepo.

- Use `pnpm` for package management.
- Use `Turborepo` to manage the monorepo.
- Core animation logic (`src`) will be split into two packages under `packages/`:
  - `pixiani-engine` (core logic, types)
  - `pixiani-anis` (animation implementations)
- `demo` and `editor` will depend on `pixiani-engine` and `pixiani-anis`.
- All npm scripts will be managed by `Turborepo`.

## 2. Task Breakdown

### Step 1: Project Setup and Scaffolding

1.  **Create `pnpm-workspace.yaml`:** Define the workspace to include `apps/*` and `packages/*`.
2.  **Create `turbo.json`:** Set up the initial Turborepo configuration.
3.  **Create directory structure:** Create `apps/` and `packages/` directories.

### Step 2: Create `pixiani-engine` and `pixiani-anis` Packages

1.  **Move source files:** Split `src/` into `packages/pixiani-engine/src` (core) and `packages/pixiani-anis/src` (animations).
2.  **Move test files:** Place tests under `packages/pixiani-engine/tests` and `packages/pixiani-anis/tests` according to the code being tested.
3.  **Create `package.json` for each package:** Create a `package.json` for `pixiani-engine` and another for `pixiani-anis`.
    - Each will contain appropriate dependencies such as `pixi.js` and package-specific dev deps.
    - Each will have its own build and test scripts as needed.
4.  **Create `tsconfig.json` for each package:** Create `tsconfig.json` files for both `pixiani-engine` and `pixiani-anis` packages.
5.  **Update `vite.lib.config.ts`:** Move and update the vite config for building the library.

### Step 3: Create `demo` and `editor` Apps

1.  **Move `demo` app:** Move the `demo/` directory to `apps/demo`.
2.  **Move `editor` app:** Move the `editor/` directory to `apps/editor`.
3.  **Create `package.json` for each app:**
    - `apps/demo/package.json` will depend on `@pixi-animation-library/pixiani-engine` and `@pixi-animation-library/pixiani-anis` using `workspace:*`.
    - `apps/editor/package.json` will also depend on those two packages using `workspace:*`.
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
