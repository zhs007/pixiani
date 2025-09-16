# Plan 025 Report: Editor Environment Refactor

## 1. Task Summary

The task was to refactor the `editor` application's environment setup for better maintainability. This involved two main changes:
1.  Externalizing the hardcoded `systemInstruction` prompt for the Gemini agent into a separate file.
2.  Updating the `.env.example` file to include all available environment variables for the editor server, ensuring it serves as complete documentation for configuration.

The task also required updating the project's development documentation (`jules.md`) and reviewing the agent instructions (`AGENTS.md`).

## 2. Execution Flow

The execution followed the plan precisely.

1.  **Plan Creation:** A detailed plan (`jules/plan025.md`) was created, outlining the steps for code modification, verification, and documentation.

2.  **Externalizing the Prompt:**
    - A new directory, `apps/editor/prompts`, was created to house agent-related prompts.
    - The content of the `systemInstruction` variable was moved from `apps/editor/server.ts` to a new file, `apps/editor/prompts/system.md`.

3.  **Server Modification:**
    - `apps/editor/server.ts` was modified to remove the hardcoded prompt.
    - New logic was added to read the system instruction from a file at startup.
    - This logic uses a new environment variable, `SYSTEM_INSTRUCTION_PATH`, and falls back to the default `apps/editor/prompts/system.md` if the variable is not set. This makes the prompt location configurable.

4.  **Updating `.env.example`:**
    - The root `.env.example` file was updated to include the new `SYSTEM_INSTRUCTION_PATH` variable.
    - It was also updated with previously missing variables: `AGENT_CONTINUE_TIMEOUT_MS` and `AGENT_CONTINUE_RETRIES`.
    - Descriptive comments were added for each new variable to clarify its purpose.

5.  **Verification:**
    - All project dependencies were installed using `pnpm install`.
    - The project was successfully built using `pnpm build`.
    - The full test suite was run using `pnpm test`, and all tests passed. This confirmed that the changes did not introduce any regressions.

## 3. Challenges and Solutions

The process was smooth and did not present any significant challenges. The initial plan was followed without deviation. The tool `set_plan` had some formatting requirements that were not immediately obvious, but this was resolved by reformatting the plan text.

## 4. Outcome

The task was completed successfully.
- The editor server is now more maintainable, with the large system prompt separated from the server logic.
- The `.env.example` file is now a complete reference for configuring the editor, improving the developer experience.
- All code changes are verified by the project's build and test scripts.
