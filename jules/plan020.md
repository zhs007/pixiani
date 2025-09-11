1.  **Create Plan and Report Files.**
    *   I will create `jules/plan020.md` to document this plan.
    *   At the end of the task, I will create `jules/plan020-report.md`.

2.  **Implement a Robust File Update.**
    *   In `editor/server.ts`, I will modify the `write_file` function, which is the core utility for all agent file operations (`create_...`, `update_...`).
    *   Before writing the new content, I will add a step to explicitly delete the file using `fs.unlink` if it already exists. This will be wrapped in a `try/catch` block to handle the initial creation case where no file exists to delete.
    *   This "delete-then-write" approach is more forceful than a simple overwrite and is designed to defeat any potential file caching mechanisms in the test runner.

3.  **Validate the Fix.**
    *   I will carefully review the code changes to ensure the logic is correct.
    *   I will run the project's main test suite via `npm run test` to confirm that this low-level change has not introduced any regressions.

4.  **Update Project Documentation.**
    *   The fix is a low-level implementation detail that doesn't alter the high-level architecture. Therefore, no changes to `jules.md` are required. This step will consist of creating the final report.
