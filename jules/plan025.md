# Plan 025: Refactor Editor Environment and Documentation

## 1. Goal

The primary goal of this task is to improve the maintainability and configuration of the `editor` application. This involves externalizing the large `systemInstruction` prompt into a separate file and ensuring the example environment file (`.env.example`) is complete and accurate. Additionally, project documentation (`jules.md`, `agents.md`) needs to be updated.

## 2. Task Decomposition

### Step 1: Externalize the System Instruction Prompt

1.  **Create a new directory:** `apps/editor/prompts`.
2.  **Create the prompt file:** Create a new file named `system.md` inside `apps/editor/prompts`.
3.  **Move the content:** Cut the entire multi-line string content from the `systemInstruction` constant in `apps/editor/server.ts` and paste it into `apps/editor/prompts/system.md`.

### Step 2: Modify the Editor Server to Load the Prompt

1.  **Read the prompt file:** In `apps/editor/server.ts`, modify the code to read the content of the prompt file.
2.  **Introduce a new environment variable:** Use a new environment variable, `SYSTEM_INSTRUCTION_PATH`, to define the location of the prompt file.
3.  **Implement file loading logic:**
    - Read the path from `process.env.SYSTEM_INSTRUCTION_PATH`.
    - Provide a sensible default path, such as `apps/editor/prompts/system.md`, if the environment variable is not set.
    - Use `fs.readFileSync` for simplicity, as this is a startup operation.
    - Replace the old hardcoded `systemInstruction` constant with the loaded content.

### Step 3: Update Example Environment File

1.  **Locate the file:** The file is `.env.example` in the project root.
2.  **Add missing variables:** Append the following variables to the file to document all configurable options for the editor server:
    - `AGENT_CONTINUE_TIMEOUT_MS`: Controls the server's idle timeout for the agent stream.
    - `AGENT_CONTINUE_RETRIES`: Controls the number of retries for connecting to the Gemini API.
    - `SYSTEM_INSTRUCTION_PATH`: The new variable to specify the path to the system instruction file.

### Step 4: Documentation and Reporting

1.  **Create a report:** After completing the implementation and verification, create `jules/plan025-report.md` to document the process, any challenges, and the solutions.
2.  **Update `jules.md`:** Add a new section to `jules.md` describing the new environment variables and the change to an external prompt file. This keeps the central project documentation up-to-date.
3.  **Review `AGENTS.md`:** Read through `AGENTS.md` to determine if these changes affect how an agent should interact with the repository. Given that this is an environment change, it might not require updates, but it must be checked.

## 3. Verification

1.  After making the changes, I will run the editor application using `pnpm dev:editor`.
2.  I will perform a basic interaction with the editor UI to ensure the agent initializes correctly, which will confirm the system prompt was loaded successfully.
3.  I will run `pnpm build` and `pnpm test` as required by `AGENTS.md` to ensure no regressions were introduced.
