# Plan to Implement Test-Driven Development for Gemini Agent

This plan outlines the steps to create a closed-loop, test-driven development environment for the Gemini agent within the existing animation editor.

1.  **Project Setup and Initial Exploration.** I have already explored the codebase, including `jules.md`, `AGENTS.md`, the `src` directory, and the `editor` directory. I have a clear understanding of the current implementation and its limitations.

2.  **Create Plan and Documentation Files.** I will create `jules/plan013.md` to document the plan, and at the end of the task, I will create `jules/plan013-report.md`.

3.  **Enhance the Editor Backend (`editor/server.ts`).** This is the main part of the task. I will implement the tools and logic to support the test-driven workflow.
    - I will modify the `systemInstruction` for the Gemini model in `editor/server.ts`. The new prompt will instruct the agent on the new workflow: read files, write animation, write test, run test, and debug until the test passes. It will also remove the old examples, as the agent can now read existing files.
    - I will implement a `get_allowed_files` tool. This tool will scan `src/animations`, `tests/animations`, and `src/core` to get a list of relevant files and will be made available to the Gemini agent.
    - I will implement a `read_file` tool, which will be restricted to reading files from the allowed list for security.
    - I will implement a `create_test_file` tool. It will write the test file to a temporary session directory to avoid polluting the main codebase.
    - I will implement a `run_tests` tool. This tool will use `child_process` to execute `vitest run` on the specific test file created by the agent and return the output.
    - I will update all file-writing tools (`create_animation_file`, `create_test_file`, and new `update` variants) to use temporary session-specific directories. This will require dynamically configuring Vitest to find the files.
    - I will refactor the `/api/chat` endpoint to handle the new multi-step, tool-based conversation flow.

4.  **Test the Implementation.** I will test the new workflow end-to-end.
    - I will act as a user and provide an animation request.
    - I will verify the agent's tool usage sequence.
    - I will introduce a bug to ensure the agent can receive the failure message and attempt a fix.
    - I will confirm that all file operations are correctly isolated within session directories.

5.  **Update Documentation.** I will update all relevant project documentation.
    - I will create the final report `jules/plan013-report.md`.
    - I will update `jules.md` to describe the new test-driven development loop in the editor.
    - I will update `AGENTS.md` with instructions for future agents regarding the new capabilities.
