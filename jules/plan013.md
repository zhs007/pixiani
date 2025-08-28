# Plan 013: Implement a Robust Animation Generation and Verification Loop

## Original Request

The user proposed a comprehensive solution to make the AI-powered animation generation more robust. The key ideas are:

-   **Smarter Prompting:** Enhance the initial prompt with more rules, examples, and a list of existing animation names to avoid conflicts.
-   **Interactive Requirement Gathering:** The AI agent should first clarify the user's needs, propose a detailed animation plan (including filling in missing details like duration), and get user confirmation before generating any code.
-   **Automated Verification Environment:** When the agent generates animation code, the server should not save it immediately. Instead, it should:
    1.  Spin up a temporary, headless environment (e.g., using a demo project and headless Chrome).
    2.  Run the generated animation code in this environment.
-   **Output Capture via "Spy" Objects:** The `PIXI.Sprite` objects passed to the animation should be extended to log their property changes (position, scale, alpha, etc.) to the console during the animation's `update` cycle.
-   **Closed-Loop Feedback:**
    1.  The console output (property logs and any errors) from the headless browser should be captured.
    2.  This captured data should be sent back to the AI agent.
    3.  The agent must then analyze this data to verify if the animation behaved according to its design.
    4.  If the animation is incorrect or an error occurred, the agent must debug and fix the code, triggering the verification process again.
    5.  If the animation is correct, the agent should confirm completion to the user.

## My Understanding of the Goal

The user wants to transform the current "fire-and-forget" animation generation system into a closed-loop, self-correcting system. The agent will be responsible not only for writing the code but also for empirically verifying its correctness in a real environment. This will significantly improve the reliability of the generated animations and reduce the need for manual testing and correction by the user.

The core of the task is to build the infrastructure for this verification loop within the `editor/server.ts` and create the necessary components for simulation and data capture.
