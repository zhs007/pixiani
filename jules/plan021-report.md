# Task 15: Enhance Agent's System Error Reporting - Report

This report details the implementation of an enhancement to the agent's error reporting capabilities, based on direct user feedback.

## 1. Task Summary

The agent was successfully identifying unrecoverable system-level errors and terminating its workflow as designed. However, its final report to the user was too generic (e.g., "I received a SYSTEM_ERROR"). This provided no actionable information for a human developer to diagnose the underlying problem.

The goal of this task, based on the user's suggestion, was to make the agent's system error reports detailed and informative.

## 2. Implementation Details

The solution involved improving the information pipeline from the test runner back to the agent, and then updating the agent's instructions on how to use that information.

### 2.1. Enhancing the `run_tests` Tool

- **Problem:** The `run_tests` function in `editor/server.ts` was detecting system errors (like "No test files found" or "Failed to resolve import") but was then discarding the original error output and returning a hardcoded, generic `SYSTEM_ERROR` message.
- **Solution:** I modified the `run_tests` function. When it detects a system error, it now constructs a new, detailed error string. This string still starts with the `SYSTEM_ERROR:` prefix (for programmatic detection by the agent) but now also includes the full, original `stdout` and `stderr` from the failed `vitest` command.

  Example of the new error format:
  `SYSTEM_ERROR: Test runner failed... Original error:\n\n[Full stdout/stderr output]`

### 2.2. Updating the Agent's System Prompt

- **Problem:** The agent's instructions were simply to stop and report "the system error." It had no instruction to provide details.
- **Solution:** I updated the system prompt in `editor/server.ts`. The rule for handling `SYSTEM_ERROR` now explicitly instructs the agent to "Report the **full, detailed** system error message to the user as your final answer so they can debug it."

## 3. Final Outcome

This enhancement creates a much more transparent and useful debugging loop. When a new, unforeseen environment or system-level issue occurs, the agent will now act as a proper informant. Its final message will contain the complete, raw error log from the failed process, giving a human developer the exact information needed to diagnose and fix the underlying problem efficiently. This fulfills the user's request and makes the entire system more maintainable.
