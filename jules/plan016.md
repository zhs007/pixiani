1.  **Create Plan and Report Files.**
    *   I will create `jules/plan016.md` to document this plan.
    *   At the end of the task, I will create `jules/plan016-report.md`.

2.  **Diagnose Module Alias Configuration.**
    *   I will investigate the project's configuration files (`vite.config.ts`, `vitest.config.ts`, `tsconfig.json`) to determine exactly where the `pixi-animation-library` path alias is defined and why it's not being applied during sandboxed test runs.

3.  **Fix Alias Resolution for Sandboxed Tests.**
    *   Based on my diagnosis, I will modify the `run_tests` function in `editor/server.ts`.
    *   The likely solution is to adjust the `vitest` command-line arguments to explicitly point to the correct Vite configuration file, ensuring that the path alias is always loaded.

4.  **Validate the Fix.**
    *   I will create a temporary test file within a dummy `.sessions` directory that uses the `pixi-animation-library` import.
    *   I will then execute the updated `vitest` command from my `run_tests` function logic to confirm that the import is now resolved correctly and the test runs without errors.
    *   Finally, I will clean up the temporary files.

5.  **Update Project Documentation.**
    *   I will update `jules.md` to document the solution for the module alias resolution issue.
