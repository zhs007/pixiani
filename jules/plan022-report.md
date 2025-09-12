# Task 16: Standardize Agent Import Strategy - Report

This report details the diagnosis and resolution of a critical import path issue caused by the introduction of the "staging area" architecture.

## 1. Task Summary

After implementing the "staging area" to prevent Vite server crashes, a new issue emerged. The agent's tests began failing with the error: `Failed to resolve import "../../src/core/BaseObject"`. This happened because the test files were now being run from a deeper directory (`.sessions/<id>/staging/tests/...`), which broke the hardcoded relative path assumption in the agent's instructions.

The goal of this task was to create a robust and permanent solution for how the agent handles imports, making the process independent of the file system's directory structure.

## 2. Implementation Details

The solution was to move away from fragile relative paths and fully embrace the project's existing module alias.

### 2.1. Diagnosis

I quickly realized that simply telling the agent to use a different relative path (e.g., `../../../src/...`) would be a brittle, temporary fix. The correct, long-term solution was to use the `pixi-animation-library` alias that is configured in `vitest.config.ts`.

However, a key insight was that this could not apply to *all* imports. The new animation class being tested by the agent (e.g., `YourClassName`) only exists within the temporary session directory and is not part of the main library build. Therefore, it *must* be imported via a relative path.

This led to the final, hybrid solution: use aliases for the stable library code and a relative path for the code under test.

### 2.2. Updating the Agent's System Prompt

The core of the fix was a major clarification of the import rules in the agent's system prompt in `editor/server.ts`.

*   **Old Rules:** The previous instructions were ambiguous and mixed different import styles.
*   **New Rules:** The prompt now provides very clear, two-part instructions for writing test files:
    1.  **For the Animation Class being tested:** The agent MUST use a relative path, which is always `../../src/animations/YourClassName`.
    2.  **For ALL other library code (`BaseObject`, `BaseAnimate`, etc.):** The agent MUST use the `'pixi-animation-library'` alias.
*   The prompt was enhanced with examples, bolding, and a counter-example of what *not* to do, to make the instructions as unambiguous as possible.

### 2.3. Verifying Library Exports

I also verified that the main library entry point, `src/index.ts`, already exports all the necessary core classes (`BaseObject`, `BaseAnimate`, etc.), making them available through the alias. No changes were needed here.

## 3. Final Outcome

This change establishes a clear, robust, and permanent strategy for how the agent should handle imports. It correctly leverages the project's module alias for stability while using a relative path where necessary for the code being generated. This decoupling from the underlying file structure makes the entire TDD workflow less brittle and easier to maintain. The agent is now equipped with the precise instructions needed to avoid path-related import errors.
