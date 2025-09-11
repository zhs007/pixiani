1.  **Create Plan and Report Files.**
    *   I will create `jules/plan017.md` to document this plan.
    *   At the end of the task, I will create `jules/plan017-report.md`.

2.  **Enhance Backend (`editor/server.ts`) to Send File Path.**
    *   In the `/api/chat` endpoint, I will capture the full file path of the newly created animation file when the `create_animation_file` tool is successfully executed.
    *   I will then modify the `workflow_complete` event payload to include this captured `filePath` along with the `className`.

3.  **Update Frontend (`editor/web/components/App.tsx`) to Directly Load New Animation.**
    *   I will refactor the `workflow_complete` event handler in the `EventSource` logic.
    *   Instead of re-fetching the entire list of animations, the new logic will use the `filePath` from the event data to directly and dynamically import the new animation module.
    *   Upon successful import, the new animation class will be added to the component's state, making it immediately available in the UI and automatically selecting it.

4.  **Validate the Fix.**
    *   After implementing the code changes, I will carefully review them to ensure the logic is sound and the data flows correctly from backend to frontend.
    *   I will also run the project's automated test suite (`npm run test`) to ensure my changes have not introduced any regressions.

5.  **Update Project Documentation.**
    *   I will update `jules.md` to reflect the new, more robust method of loading animations in the editor.
