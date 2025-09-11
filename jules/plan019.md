1.  **Create Plan and Report Files.**
    *   I will create `jules/plan019.md` to document this plan.
    *   At the end of the task, I will create `jules/plan019-report.md`.

2.  **Modify File Tools to Use a Staging Area.**
    *   In `editor/server.ts`, I will modify the `write_file` function. All files created by the agent (`create_animation_file`, `update_animation_file`, etc.) will now be written to a `staging` subdirectory within the session folder (e.g., `.sessions/<session-id>/staging/src/animations/`).

3.  **Update `run_tests` to Use the Staging Area.**
    *   I will update the `run_tests` function in `editor/server.ts` to construct file paths pointing to the test files within the new `staging` directory.

4.  **Implement the "Publish on Success" Step.**
    *   This is the key architectural change. In the `/api/chat` endpoint's main loop, after the `run_tests` tool reports a success, I will add a new "publish" step.
    *   This step will move the validated animation and test files from the `staging` directory to their final location in the parent session directory (e.g., from `.sessions/<id>/staging/src` to `.sessions/<id>/src`).
    *   The `workflow_complete` event will only be sent *after* this move is successful, and the `filePath` in the event will point to the final, "published" path.

5.  **Validate the New Workflow.**
    *   I will run the project's automated test suite (`npm run test`) to check for regressions.
    *   I will carefully review the code changes to ensure the new staging, testing, and publishing logic is sound and correctly implemented.

6.  **Update Project Documentation.**
    *   I will update `jules.md` to describe the new, more robust "staging -> test -> publish" architecture that protects the Vite server from crashing on syntax errors.
