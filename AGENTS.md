# Agent Instructions

This document provides instructions for AI agents working on this codebase.

## Project Overview

This is a web-based game animation library using Pixi.js and TypeScript. The goal is to create a modular, well-tested, and well-documented library for creating animations in mobile web games.

## Development Environment

- **Language:** TypeScript
- **Package Manager:** npm (or pnpm/yarn if lock files are present)
- **Build Tool:** Vite
- **Testing:** Vitest

Before starting, please install dependencies using `npm install`.

## Key Commands

- `npm run dev`: Starts the development server for the demo page.
- `npm run build`: Builds the library for production.
- `npm run test`: Runs the unit tests.
- `npm run coverage`: Runs tests and generates a coverage report.

## Coding Conventions

1.  **TypeScript:**
    - Use strict mode (`"strict": true` in `tsconfig.json`).
    - Provide explicit types for all function parameters, return values, and class properties. Avoid `any` unless absolutely necessary.
    - All core interfaces and types should be defined in `src/core/types.ts`.

2.  **Comments:**
    - Use JSDoc for all exported classes, methods, functions, and types.
    - Comments should explain _why_ the code is doing something, not just _what_ it is doing.

3.  **Modularity:**
    - Keep files small and focused on a single responsibility.
    - New animations should be placed in their own file under `src/animations/`.
    - Core logic (managers, base classes) resides in `src/core/`.

4.  **Testing:**
    - All new features or bug fixes must be accompanied by unit tests.
    - Aim for a test coverage of at least 90% for logical parts of the codebase.
    - Tests for a file `src/path/to/file.ts` should be located at `tests/path/to/file.test.ts`.

## Agent Workflow

1.  **Understand the Goal:** Read the task description and relevant files (`jules.md`, `*.plan.md`) carefully.
2.  **Create/Update Plan:** Propose a clear, step-by-step plan to accomplish the task.
3.  **Implement:** Write code following the conventions above.
4.  **Test:** Write and run tests to verify your changes.
5.  **Verify in Demo:** Use the demo page (`npm run dev`) to visually inspect your changes, especially for new animations or visual features.
6.  **Submit:** Once all checks pass, submit your work with a clear commit message.

## Programmatic Checks

After making changes and before submitting, you MUST run the following commands and ensure they pass without errors:

1.  `npm run build`
2.  `npm run test`

If you add new dependencies, run `npm install` first. If you modify any logic, ensure the test coverage does not drop by running `npm run coverage` and inspecting the results. Any failure in these checks must be addressed before submission.

## Working on the Gemini Editor (`editor/server.ts`)

If your task involves modifying the Gemini animation editor, be aware of the following special considerations.

### TDD Workflow for the Editor's Agent

The editor's backend implements a Test-Driven Development (TDD) loop for the worker agent that generates animations. When you are modifying `editor/server.ts`, you are changing the environment in which this worker agent operates.

The worker agent has access to a specific set of tools (function calls) that you, as the "meta-agent", are responsible for maintaining. These tools are:

- `get_allowed_files()`: Lists existing animation and test files.
- `read_file(filepath)`: Reads a file.
- `create_animation_file(className, code)`: Creates the animation source file.
- `create_test_file(className, code)`: Creates the test file.
- `run_tests(className)`: Executes `vitest` on the generated test.
- `update_animation_file(className, code)`: Updates the animation source.
- `update_test_file(className, code)`: Updates the test file.

### Modifying the Workflow

If you need to change this workflow (e.g., by adding a new tool or changing how tests are run), you must:

1.  **Update the Tool Definition:** Modify the `tools` constant in `editor/server.ts` to reflect the new function signature.
2.  **Update the Tool Implementation:** Add or modify the corresponding helper function that implements the tool's logic.
3.  **Update the System Prompt:** Change the `systemInstruction` constant to inform the worker agent about the new tool or workflow change.
4.  **Verify CI:** Ensure that `npm run ci` still passes after your changes. The editor server code is type-checked and linted as part of this process.
