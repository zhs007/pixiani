# Task 7: Gemini TDD Workflow - Report

This report details the implementation of a Test-Driven Development (TDD) workflow for the Gemini agent within the animation editor.

## 1. Task Summary

The goal of this task was to enhance the existing Gemini-powered animation editor to support a more robust, test-driven workflow. Instead of just generating code, the Gemini agent should now be able to:

1.  Read existing project files for context.
2.  Write a new animation class.
3.  Write a corresponding test file for the new class.
4.  Execute the tests and receive the results.
5.  Debug the code based on test failures until the tests pass.

This creates a closed loop of development, significantly improving the quality and reliability of the AI-generated animations.

## 2. Implementation Details

The core of the work involved modifying the editor's backend server (`editor/server.ts`).

### 2.1. Enhanced Gemini Prompt

The system prompt for the Gemini model was completely rewritten to instruct the agent on the new TDD workflow. It now clearly outlines the steps: explore, code, test, run, and debug. The old hardcoded examples were removed, as the agent can now read existing files for reference.

### 2.2. New Agent Tools

A suite of new function-calling tools was implemented to empower the agent:

- `get_allowed_files()`: Scans the `src` and `tests` directories and returns a list of readable files.
- `read_file(filepath)`: Reads a specific file from the allowed list.
- `create_animation_file(className, code)`: Saves a new animation file to a temporary session directory.
- `create_test_file(className, code)`: Saves a new test file to a temporary session directory.
- `update_animation_file(className, code)`: Updates an existing animation file in the session directory.
- `update_test_file(className, code)`: Updates an existing test file in the session directory.
- `run_tests(className)`: Executes the tests for the specified animation within the sandboxed session environment and returns the output from `vitest`.

### 2.3. Sandboxed Test Execution

The most complex part of the implementation was the `run_tests` function. To ensure that tests for generated code are isolated and don't interfere with the main project, the following mechanism was implemented:

1.  All generated files (animations and tests) for a user session are stored in a temporary directory: `.sessions/<session-id>/`.
2.  The test files are written to expect a standard project structure (e.g., importing from `../../src/...`).
3.  The `run_tests` function executes `vitest` with the `--root` flag pointing to the main project directory. This allows `vitest` to pick up the main `vitest.config.ts`, which is crucial for resolving aliases like `pixi-animation-library`.
4.  By passing the specific path to the generated test file, `vitest` runs only that test, and the relative paths inside it correctly resolve to the sandboxed animation file within the session directory.

## 3. Challenges and Solutions

The implementation process, particularly the testing phase, presented several challenges.

- **CI/CD Failures:** The main challenge was a persistent series of failures from the `npm run ci` command. This was caused by a combination of linting errors, TypeScript compilation errors, and formatting issues.
- **Scoping Bug:** The most difficult bug to diagnose was a variable shadowing issue. Inside the `run_tests` function, the `resolve` function from the `new Promise((resolve) => ...)` constructor was shadowing the `resolve` function imported from the `path` module. This caused a TypeScript error (`Expected 1 arguments, but got 5`) that was initially very confusing.
  - **Solution:** The bug was fixed by renaming the promise's resolve function to `promiseResolve`, which resolved the name conflict.
- **Test Runner Configuration:** I initially over-engineered a solution involving a temporary `vitest.config.ts` file for each session. After several failed attempts, I realized a much simpler approach was possible by leveraging `vitest`'s command-line options (`--root` and specifying the test file path directly). This highlights the importance of fully understanding the capabilities of the tools being used.
- **Iterative Debugging:** The process of getting the CI checks to pass was highly iterative. It involved making a change, running the check, analyzing the error, and repeating. This trial-and-error process, while slow, was effective in systematically eliminating all the issues.

## 4. Final Outcome

The editor backend is now equipped with a complete TDD workflow for the Gemini agent. The implementation is robust, sandboxed, and has been validated against all project quality gates (linting, typing, formatting, and testing). The project is now ready for the next phase of development.
