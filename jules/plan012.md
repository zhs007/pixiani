# Plan 012: Editor Feature Enhancement

This plan covers a set of feature enhancements for the Gemini Animation Editor, as requested by the user.

## Task Breakdown

### 1. Code Refactoring
*   **Goal:** Improve maintainability of the editor's frontend code.
*   **Action:** Break down the monolithic `editor/web/main.tsx` into smaller, more manageable components.
    *   Create `editor/web/components/App.tsx` for the main application logic.
    *   Create `editor/web/components/ChatPanel.tsx` for the chat interface.
    *   Create `editor/web/components/PreviewPanel.tsx` for the animation preview and controls.
    *   Create `editor/web/components/AssetSelectionModal.tsx` for the new asset selection UI.
    *   Update `editor/web/main.tsx` to import and render the new `App` component.

### 2. Implement Animation Controls & Asset Selection
*   **Goal:** Add controls for looping, playback speed, and allow users to select sprites for animations.
*   **Actions:**
    1.  **Add UI Controls:** In `PreviewPanel.tsx`, add:
        *   A "Loop" checkbox, checked by default.
        *   A number input for "Speed", with a default value of `1.0`, min value of `0.1`, and step of `0.1`.
    2.  **State Management:** Add state in `App.tsx` to manage `loop` (boolean), `speed` (number), and the visibility of the asset selection modal.
    3.  **Implement Asset Selection Modal:** In `AssetSelectionModal.tsx`:
        *   Fetch the list of available assets from a new API endpoint (e.g., `/api/assets`).
        *   Display the assets as selectable images.
        *   Include a file upload input.
        *   Handle image uploads by sending them to a new API endpoint (e.g., `/api/upload-asset`).
    4.  **Modify "Play" Logic:**
        *   When the "Play" button is clicked in `PreviewPanel.tsx`, it will now open the `AssetSelectionModal`.
        *   The modal will require the user to select a number of sprites equal to what the animation needs.
        *   On confirmation, the modal will pass the selected image URLs back to the `App` component.
    5.  **Update Animation Creation:**
        *   The `handlePlayAnimation` function in `App.tsx` will now use the selected image URLs to create the PIXI textures.
        *   It will also use the `loop` and `speed` values when creating/playing the animation. (Note: This may require changes to the core animation library if not already supported).

### 3. Adjust Pixi.js Rendering
*   **Goal:** Center the rendering canvas origin and default object positions.
*   **Actions:**
    1.  **Center Stage:** In `App.tsx`, where the `PIXI.Application` is created, set `app.stage.x` and `app.stage.y` to center the coordinate system.
    2.  **Center Object:** In the `handlePlayAnimation` function, set the `BaseObject`'s position to `(0, 0)` to place it at the new origin.

### 4. Enhance Chat UI
*   **Goal:** Improve the chat interface by enlarging the input area and adding Markdown support.
*   **Actions:**
    1.  **Enlarge Text Area:** In `ChatPanel.tsx`, modify the inline styles for the `<textarea>` to double its height.
    2.  **Add Markdown Support:**
        *   Add `react-markdown` and `remark-gfm` to the project's dependencies (`npm install react-markdown remark-gfm`).
        *   In `ChatPanel.tsx`, use the `<ReactMarkdown>` component to render the chat messages.

### 5. Final Verification
*   **Goal:** Ensure all changes are working correctly and the project is stable.
*   **Actions:**
    1.  **Run Checks:** Execute `npm run test` and `npm run build` as per `AGENTS.md` and fix any resulting errors.
    2.  **Manual Test:** Manually test all new features in the browser to confirm they work as expected.
    3.  **Create Report:** Write the `jules/plan012-report.md` file.
    4.  **Update Documentation:** Update `jules.md` and `AGENTS.md` if necessary.
