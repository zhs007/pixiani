1.  **Create Plan and Report Files.**
    - I will create `jules/plan021.md` to document this plan.
    - At the end of the task, I will create `jules/plan021-report.md`.

2.  **Enhance `run_tests` Error Reporting.**
    - In `editor/server.ts`, I will modify the `run_tests` function.
    - When a system-level error (like "No test files found") is detected, the string returned to the agent will be enhanced. It will still start with the `SYSTEM_ERROR:` prefix but will now also include the full `stdout` and `stderr` from the failed test command.

3.  **Update Agent System Prompt.**
    - In `editor/server.ts`, I will update the agent's system prompt.
    - The instructions for handling a `SYSTEM_ERROR` will be revised to explicitly command the agent to include the full, detailed error message it receives from the tool in its final report to the user.

4.  **Validate the Fix.**
    - I will validate the changes primarily through code inspection.
    - I will also temporarily add a `console.log` to the `run_tests` function and simulate an error to ensure the detailed error string is formatted correctly, then remove the log.
    - Finally, I will run the main `npm run test` suite to ensure no regressions were introduced.

5.  **Update Project Documentation.**
    - I will update the "错误处理" (Error Handling) section in `jules.md` to reflect that the agent will now provide detailed logs for system-level errors.
