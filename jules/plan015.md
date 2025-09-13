1.  **Create Plan and Report Files.**
    - I will create `jules/plan015.md` to document this plan.
    - At the end of the task, I will create `jules/plan015-report.md` to document the execution and outcomes.

2.  **Fix Sandboxed Test Execution.**
    - I will start by reading `vitest.config.ts` to diagnose why tests within the `.sessions` directory are not being found by the test runner.
    - Based on the diagnosis, I will implement a robust fix. This will likely involve either modifying the `vitest` command in `editor/server.ts` to override the configuration or directly altering `vitest.config.ts` to ensure session directories are correctly included in test runs.

3.  **Improve Agent's Environmental Error Handling.**
    - I will enhance the `run_tests` tool in `editor/server.ts`. The tool will be updated to parse the test runner's output to specifically identify unrecoverable environment errors (like "No test files found").
    - If such an error is detected, the tool will return a special, structured error message (e.g., `SYSTEM_ERROR: Test runner failed due to an environment issue.`).
    - I will update the agent's system prompt in `editor/server.ts`, instructing it to terminate its workflow immediately upon receiving a `SYSTEM_ERROR` and to report this specific type of error to the user.

4.  **Validate the Fixes.**
    - I will conduct an end-to-end test by running a complete agent workflow to generate an animation and confirm that its test now executes successfully from the sandboxed `.sessions` directory.
    - I will also simulate an environment error to verify that the agent correctly identifies the `SYSTEM_ERROR` and halts its process as per the new instructions.

5.  **Update Project Documentation.**
    - I will update `jules.md` to document the fix for the sandboxed test environment and the new, more robust error-handling logic for the agent.
