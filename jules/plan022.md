1.  **Create Plan and Report Files.**
    *   I will create `jules/plan022.md` to document this plan.
    *   At the end of the task, I will create `jules/plan022-report.md`.

2.  **Ensure All Necessary Modules are Exported.**
    *   I will first inspect the main library entry point, `src/index.ts`, to see which modules are currently exported.
    *   I will then update `src/index.ts` to ensure it exports all modules that the agent needs to import via the `'pixi-animation-library'` alias, such as `BaseObject`, `BaseAnimate`, and all animation classes.

3.  **Update Agent System Prompt for Imports.**
    *   In `editor/server.ts`, I will rewrite the import rules in the agent's system prompt.
    *   The new instructions will remove any mention of relative paths and will mandate the use of the `'pixi-animation-library'` alias for **all** internal imports (e.g., `import { YourClassName, BaseObject } from 'pixi-animation-library';`).

        *   Clarification: the repository's own source files under `src/` (for example `src/animations/*` and `src/core/*`) should continue to use relative imports for internal dependencies (e.g. `import { BaseAnimate } from '../core/BaseAnimate'`). This avoids creating circular imports (an animation file importing the library entry which re-exports that same animation) and keeps the library build simple. The `'pixi-animation-library'` alias is intended for agent-generated code and external consumers (including tests run in the sandbox/staging area), not for the library's internal files.

4.  **Validate the Fix.**
    *   I will run the main test suite (`npm run test`) to ensure that exporting additional modules from `src/index.ts` does not cause any regressions.
    *   I will carefully review the changes to the system prompt to ensure the instructions are clear and accurate.

5.  **Update Project Documentation.**
    *   I will update `jules.md` to document the new, standardized import strategy that agents are required to follow.
