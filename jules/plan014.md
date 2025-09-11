1.  **Create Plan and Report Files.**
    *   I will create `jules/plan014.md` to document this plan.
    *   At the end of the task, I will create `jules/plan014-report.md` to document the execution, challenges, and solutions.

2.  **Refactor Backend (`editor/server.ts`) for Autonomous, Streaming Workflow.**
    *   **Implement a Streaming Endpoint:** I will modify the `/api/chat` endpoint to use a streaming response (likely Server-Sent Events, SSE). This will allow the server to push multiple updates to the client over a single connection.
    *   **Create an Agent Execution Loop:** I will introduce a loop that orchestrates the agent's workflow. This loop will repeatedly call the Gemini model, execute the requested tool, and send the tool's output back to the model.
    *   **Implement a Step Limit:** The execution loop will have a maximum iteration limit (e.g., 10 steps) to prevent infinite execution and notify the user if the limit is reached.
    *   **Stream Progress Updates:** During each step of the loop, I will send a JSON message to the client, indicating the current action (e.g., `{ "type": "tool_call", "toolName": "create_test_file" }`).
    *   **Signal Completion:** When the agent's workflow is finished (i.e., it returns a final text response), I will send a special completion event to the client, including the name of the newly created animation class (e.g., `{ "type": "workflow_complete", "className": "MyNewAnimation" }`).

3.  **Update Frontend (`editor/web/components/App.tsx`) to Handle Streaming and Auto-Preview.**
    *   **Consume the Stream:** I will modify the `handleSendMessage` function to use the `EventSource` API (or a similar streaming mechanism) to connect to the `/api/chat` endpoint and listen for incoming messages.
    *   **Display Real-time Feedback:** I will update the chat UI in real-time based on the progress updates received from the server. This will replace the simple `isThinking` state with more descriptive messages like "Agent is writing tests...".
    *   **Automate Animation Preview:** Upon receiving the `workflow_complete` event, I will:
        a. Automatically call `loadCustomAnimations()` to refresh the list of available animations from the server.
        b. Update the component's state to select the newly created animation in the `PreviewPanel` dropdown, making it immediately ready for testing.

4.  **Update Project Documentation.**
    *   I will update the main `jules.md` file to reflect the new autonomous and interactive nature of the Gemini Animation Editor.
    *   I will review the `agents.md` file (if it existed) and update it if the changes I've made are relevant for future agent interactions.
